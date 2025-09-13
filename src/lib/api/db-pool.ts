import { supabaseServer } from "@/lib/supabase/server";

/**
 * Database connection pool and query optimization utilities
 */
export class DatabasePool {
  private static instance: DatabasePool;
  private connectionPool: Map<string, any> = new Map();
  private queryCache: Map<string, { data: any; timestamp: number; ttl: number }> = new Map();
  private readonly DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

  private constructor() {
    // Cleanup expired cache entries every 10 minutes
    setInterval(() => {
      this.cleanupExpiredCache();
    }, 10 * 60 * 1000);
  }

  static getInstance(): DatabasePool {
    if (!DatabasePool.instance) {
      DatabasePool.instance = new DatabasePool();
    }
    return DatabasePool.instance;
  }

  /**
   * Get a cached Supabase client or create a new one
   */
  getConnection(key: string = 'default'): any {
    if (!this.connectionPool.has(key)) {
      this.connectionPool.set(key, supabaseServer());
    }
    return this.connectionPool.get(key);
  }

  /**
   * Execute a query with caching support
   */
  async executeQuery<T>(
    queryKey: string,
    queryFn: () => Promise<T>,
    cacheTtl: number = this.DEFAULT_CACHE_TTL
  ): Promise<T> {
    // Check cache first
    const cached = this.queryCache.get(queryKey);
    if (cached && Date.now() - cached.timestamp < cached.ttl) {
      return cached.data;
    }

    // Execute query
    const result = await queryFn();

    // Cache the result
    this.queryCache.set(queryKey, {
      data: result,
      timestamp: Date.now(),
      ttl: cacheTtl
    });

    return result;
  }

  /**
   * Execute multiple queries in parallel with connection reuse
   */
  async executeParallelQueries<T>(
    queries: Array<{
      key: string;
      queryFn: (client: any) => Promise<T>;
      cacheTtl?: number;
    }>
  ): Promise<T[]> {
    const client = this.getConnection();
    
    const promises = queries.map(async ({ key, queryFn, cacheTtl }) => {
      return this.executeQuery(
        key,
        () => queryFn(client),
        cacheTtl || this.DEFAULT_CACHE_TTL
      );
    });

    return Promise.all(promises);
  }

  /**
   * Execute batch RPC operations with optimized connection handling
   */
  async executeBatchRPC<T>(
    rpcName: string,
    batches: Array<{ key: string; params: any }>,
    cacheTtl?: number
  ): Promise<Record<string, T>> {
    const client = this.getConnection();
    const results: Record<string, T> = {};

    // Group similar operations to reduce RPC calls
    const promises = batches.map(async ({ key, params }) => {
      const cacheKey = `${rpcName}:${JSON.stringify(params)}`;
      const result = await this.executeQuery(
        cacheKey,
        async () => {
          const { data, error } = await client.rpc(rpcName, params);
          if (error) throw new Error(`RPC ${rpcName} failed: ${error.message}`);
          return data;
        },
        cacheTtl
      );
      results[key] = result;
    });

    await Promise.all(promises);
    return results;
  }

  /**
   * Invalidate cache entries by pattern
   */
  invalidateCache(pattern: string): void {
    const regex = new RegExp(pattern);
    for (const key of this.queryCache.keys()) {
      if (regex.test(key)) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Clear all cached queries
   */
  clearCache(): void {
    this.queryCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    hitRate: number;
    entries: Array<{ key: string; age: number; ttl: number }>;
  } {
    const entries = Array.from(this.queryCache.entries()).map(([key, value]) => ({
      key,
      age: Date.now() - value.timestamp,
      ttl: value.ttl
    }));

    return {
      size: this.queryCache.size,
      hitRate: 0, // Would need to track hits/misses for accurate calculation
      entries
    };
  }

  /**
   * Clean up expired cache entries
   */
  private cleanupExpiredCache(): void {
    const now = Date.now();
    for (const [key, value] of this.queryCache.entries()) {
      if (now - value.timestamp >= value.ttl) {
        this.queryCache.delete(key);
      }
    }
  }

  /**
   * Optimize query execution with retry logic
   */
  async executeWithRetry<T>(
    queryFn: () => Promise<T>,
    maxRetries: number = 3,
    backoffMs: number = 1000
  ): Promise<T> {
    let lastError: Error;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await queryFn();
      } catch (error) {
        lastError = error as Error;
        
        if (attempt === maxRetries) break;

        // Exponential backoff
        const delay = backoffMs * Math.pow(2, attempt);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }

    throw lastError!;
  }

  /**
   * Execute queries with circuit breaker pattern
   */
  private circuitBreakers: Map<string, {
    failures: number;
    lastFailure: number;
    state: 'closed' | 'open' | 'half-open';
  }> = new Map();

  async executeWithCircuitBreaker<T>(
    key: string,
    queryFn: () => Promise<T>,
    failureThreshold: number = 5,
    timeoutMs: number = 60000
  ): Promise<T> {
    const breaker = this.circuitBreakers.get(key) || {
      failures: 0,
      lastFailure: 0,
      state: 'closed' as const
    };

    const now = Date.now();

    // Check circuit breaker state
    if (breaker.state === 'open') {
      if (now - breaker.lastFailure > timeoutMs) {
        breaker.state = 'half-open';
      } else {
        throw new Error(`Circuit breaker open for ${key}`);
      }
    }

    try {
      const result = await queryFn();
      
      // Reset on success
      if (breaker.state === 'half-open') {
        breaker.state = 'closed';
        breaker.failures = 0;
      }
      
      this.circuitBreakers.set(key, breaker);
      return result;
    } catch (error) {
      breaker.failures++;
      breaker.lastFailure = now;

      if (breaker.failures >= failureThreshold) {
        breaker.state = 'open';
      }

      this.circuitBreakers.set(key, breaker);
      throw error;
    }
  }
}

// Export singleton instance
export const dbPool = DatabasePool.getInstance();