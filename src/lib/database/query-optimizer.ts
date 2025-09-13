/**
 * Database Query Optimizer
 * Provides connection pooling, query batching, and performance monitoring
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

interface QueryMetrics {
  query: string;
  duration: number;
  timestamp: Date;
  success: boolean;
  error?: string;
  rowCount?: number;
}

interface BatchQuery {
  id: string;
  query: string;
  params?: any;
  resolve: (result: any) => void;
  reject: (error: any) => void;
}

interface ConnectionPoolConfig {
  maxConnections: number;
  idleTimeout: number;
  connectionTimeout: number;
}

class DatabaseQueryOptimizer {
  private static instance: DatabaseQueryOptimizer;
  private connectionPool: Map<string, SupabaseClient> = new Map();
  private queryMetrics: QueryMetrics[] = [];
  private batchQueue: BatchQuery[] = [];
  private batchTimer: NodeJS.Timeout | null = null;
  private config: ConnectionPoolConfig;

  private constructor() {
    this.config = {
      maxConnections: parseInt(process.env.DB_MAX_CONNECTIONS || '10'),
      idleTimeout: parseInt(process.env.DB_IDLE_TIMEOUT || '30000'),
      connectionTimeout: parseInt(process.env.DB_CONNECTION_TIMEOUT || '5000')
    };
  }

  static getInstance(): DatabaseQueryOptimizer {
    if (!DatabaseQueryOptimizer.instance) {
      DatabaseQueryOptimizer.instance = new DatabaseQueryOptimizer();
    }
    return DatabaseQueryOptimizer.instance;
  }

  /**
   * Get optimized Supabase client with connection pooling
   */
  getOptimizedClient(key?: string): SupabaseClient {
    const poolKey = key || 'default';
    
    if (!this.connectionPool.has(poolKey)) {
      if (this.connectionPool.size >= this.config.maxConnections) {
        // Remove oldest connection if pool is full
        const oldestKey = this.connectionPool.keys().next().value;
        if (oldestKey) {
          this.connectionPool.delete(oldestKey);
        }
      }

      const client = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        key || process.env.SUPABASE_SERVICE_ROLE_KEY!,
        {
          auth: { persistSession: false },
          db: {
            schema: 'public'
          }
        }
      );

      this.connectionPool.set(poolKey, client);

      // Set idle timeout
      setTimeout(() => {
        this.connectionPool.delete(poolKey);
      }, this.config.idleTimeout);
    }

    return this.connectionPool.get(poolKey)!;
  }

  /**
   * Execute query with performance monitoring
   */
  async executeQuery<T>(
    client: SupabaseClient,
    queryFn: (client: SupabaseClient) => Promise<{ data: T; error: any }>,
    queryName: string
  ): Promise<{ data: T; error: any }> {
    const startTime = Date.now();
    
    try {
      const result = await queryFn(client);
      const duration = Date.now() - startTime;
      
      this.recordMetrics({
        query: queryName,
        duration,
        timestamp: new Date(),
        success: !result.error,
        error: result.error?.message,
        rowCount: Array.isArray(result.data) ? result.data.length : result.data ? 1 : 0
      });

      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      
      this.recordMetrics({
        query: queryName,
        duration,
        timestamp: new Date(),
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      });

      throw error;
    }
  }

  /**
   * Batch multiple queries for efficient execution
   */
  async batchQuery<T>(
    queryName: string,
    queryFn: (client: SupabaseClient) => Promise<{ data: T; error: any }>
  ): Promise<{ data: T; error: any }> {
    return new Promise((resolve, reject) => {
      const batchId = `${queryName}_${Date.now()}_${Math.random()}`;
      
      this.batchQueue.push({
        id: batchId,
        query: queryName,
        params: queryFn,
        resolve,
        reject
      });

      // Process batch after short delay to collect more queries
      if (!this.batchTimer) {
        this.batchTimer = setTimeout(() => {
          this.processBatch();
        }, 10); // 10ms batch window
      }
    });
  }

  /**
   * Process batched queries
   */
  private async processBatch(): Promise<void> {
    if (this.batchQueue.length === 0) return;

    const batch = [...this.batchQueue];
    this.batchQueue = [];
    this.batchTimer = null;

    const client = this.getOptimizedClient();
    
    // Group similar queries
    const groupedQueries = new Map<string, BatchQuery[]>();
    batch.forEach(query => {
      const key = query.query;
      if (!groupedQueries.has(key)) {
        groupedQueries.set(key, []);
      }
      groupedQueries.get(key)!.push(query);
    });

    // Execute grouped queries
    for (const [queryType, queries] of groupedQueries) {
      try {
        // For now, execute queries in parallel within each group
        const promises = queries.map(async (query) => {
          try {
            const result = await this.executeQuery(
              client,
              query.params as any,
              query.query
            );
            query.resolve(result);
          } catch (error) {
            query.reject(error);
          }
        });

        await Promise.all(promises);
      } catch (error) {
        // Reject all queries in this group if batch fails
        queries.forEach(query => query.reject(error));
      }
    }
  }

  /**
   * Record query performance metrics
   */
  private recordMetrics(metrics: QueryMetrics): void {
    this.queryMetrics.push(metrics);
    
    // Keep only last 1000 metrics to prevent memory leaks
    if (this.queryMetrics.length > 1000) {
      this.queryMetrics = this.queryMetrics.slice(-1000);
    }

    // Log slow queries
    if (metrics.duration > 1000) {
      console.warn(`Slow query detected: ${metrics.query} took ${metrics.duration}ms`);
    }
  }

  /**
   * Get query performance analytics
   */
  getQueryAnalytics(timeWindow?: number): {
    totalQueries: number;
    averageResponseTime: number;
    slowQueries: QueryMetrics[];
    errorRate: number;
    topQueries: { query: string; count: number; avgDuration: number }[];
  } {
    const cutoff = timeWindow ? new Date(Date.now() - timeWindow) : new Date(0);
    const relevantMetrics = this.queryMetrics.filter(m => m.timestamp >= cutoff);

    const totalQueries = relevantMetrics.length;
    const averageResponseTime = totalQueries > 0 
      ? relevantMetrics.reduce((sum, m) => sum + m.duration, 0) / totalQueries 
      : 0;
    
    const slowQueries = relevantMetrics.filter(m => m.duration > 500);
    const errorRate = totalQueries > 0 
      ? relevantMetrics.filter(m => !m.success).length / totalQueries 
      : 0;

    // Group by query type
    const queryGroups = new Map<string, { count: number; totalDuration: number }>();
    relevantMetrics.forEach(m => {
      if (!queryGroups.has(m.query)) {
        queryGroups.set(m.query, { count: 0, totalDuration: 0 });
      }
      const group = queryGroups.get(m.query)!;
      group.count++;
      group.totalDuration += m.duration;
    });

    const topQueries = Array.from(queryGroups.entries())
      .map(([query, stats]) => ({
        query,
        count: stats.count,
        avgDuration: stats.totalDuration / stats.count
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    return {
      totalQueries,
      averageResponseTime,
      slowQueries,
      errorRate,
      topQueries
    };
  }

  /**
   * Clear connection pool
   */
  clearPool(): void {
    this.connectionPool.clear();
  }

  /**
   * Get connection pool status
   */
  getPoolStatus(): {
    activeConnections: number;
    maxConnections: number;
    poolUtilization: number;
  } {
    return {
      activeConnections: this.connectionPool.size,
      maxConnections: this.config.maxConnections,
      poolUtilization: this.connectionPool.size / this.config.maxConnections
    };
  }
}

export const queryOptimizer = DatabaseQueryOptimizer.getInstance();
export type { QueryMetrics };