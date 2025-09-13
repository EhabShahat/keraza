/**
 * Multi-tier caching system for Netlify Functions optimization
 * Implements memory, edge, and database caching with intelligent invalidation
 */

import { supabaseServer } from "@/lib/supabase/server";

/**
 * Cache tier types
 */
export type CacheTier = 'memory' | 'edge' | 'database' | 'none';

/**
 * Cache configuration interface
 */
export interface CacheConfig {
  strategy: CacheTier;
  ttl: number; // Time to live in seconds
  tags: string[]; // Cache tags for invalidation
  maxSize?: number; // Maximum cache size for memory tier
  staleWhileRevalidate?: number; // Stale-while-revalidate time in seconds
}

/**
 * Cache entry interface
 */
interface CacheEntry<T = any> {
  data: T;
  timestamp: number;
  ttl: number;
  tags: string[];
  accessCount: number;
  lastAccessed: number;
}

/**
 * Cache statistics interface
 */
export interface CacheStats {
  tier: CacheTier;
  size: number;
  maxSize: number;
  hitRate: number;
  hits: number;
  misses: number;
  evictions: number;
  totalRequests: number;
}

/**
 * Memory cache implementation with LRU eviction
 */
class MemoryCache {
  private cache = new Map<string, CacheEntry>();
  private readonly maxSize: number;
  private hits = 0;
  private misses = 0;
  private evictions = 0;

  constructor(maxSize: number = 1000) {
    this.maxSize = maxSize;
  }

  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.misses++;
      return null;
    }

    const now = Date.now();
    
    // Check if expired
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      this.misses++;
      return null;
    }

    // Update access statistics
    entry.accessCount++;
    entry.lastAccessed = now;
    this.hits++;

    // Move to end (LRU)
    this.cache.delete(key);
    this.cache.set(key, entry);

    return entry.data as T;
  }

  set<T>(key: string, data: T, config: CacheConfig): void {
    const now = Date.now();

    // Implement LRU eviction if at capacity
    if (this.cache.size >= this.maxSize) {
      this.evictLRU();
    }

    const entry: CacheEntry<T> = {
      data,
      timestamp: now,
      ttl: config.ttl,
      tags: config.tags,
      accessCount: 0,
      lastAccessed: now
    };

    this.cache.set(key, entry);
  }

  invalidateByTags(tags: string[]): number {
    let invalidated = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (entry.tags.some(tag => tags.includes(tag))) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  invalidateByPattern(pattern: RegExp): number {
    let invalidated = 0;
    
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
        invalidated++;
      }
    }

    return invalidated;
  }

  clear(): void {
    this.cache.clear();
    this.hits = 0;
    this.misses = 0;
    this.evictions = 0;
  }

  getStats(): CacheStats {
    return {
      tier: 'memory',
      size: this.cache.size,
      maxSize: this.maxSize,
      hitRate: this.hits / (this.hits + this.misses) || 0,
      hits: this.hits,
      misses: this.misses,
      evictions: this.evictions,
      totalRequests: this.hits + this.misses
    };
  }

  private evictLRU(): void {
    // Find least recently used entry
    let lruKey: string | null = null;
    let lruTime = Date.now();

    for (const [key, entry] of this.cache.entries()) {
      if (entry.lastAccessed < lruTime) {
        lruTime = entry.lastAccessed;
        lruKey = key;
      }
    }

    if (lruKey) {
      this.cache.delete(lruKey);
      this.evictions++;
    }
  }

  // Get entries for debugging/monitoring
  getEntries(): Array<{ key: string; entry: CacheEntry }> {
    return Array.from(this.cache.entries()).map(([key, entry]) => ({ key, entry }));
  }
}

/**
 * Edge cache implementation using Netlify Edge Functions
 */
class EdgeCache {
  private hits = 0;
  private misses = 0;

  async get<T>(key: string): Promise<T | null> {
    try {
      // In a real Netlify Edge Function environment, this would use the Edge Cache API
      // For now, we'll simulate with environment-specific logic
      if (typeof globalThis !== 'undefined' && (globalThis as any).netlify?.cache) {
        const cached = await (globalThis as any).netlify.cache.get(key);
        if (cached) {
          this.hits++;
          return JSON.parse(cached) as T;
        }
      }
      
      this.misses++;
      return null;
    } catch (error) {
      console.error('Edge cache get error:', error);
      this.misses++;
      return null;
    }
  }

  async set<T>(key: string, data: T, config: CacheConfig): Promise<void> {
    try {
      // In a real Netlify Edge Function environment
      if (typeof globalThis !== 'undefined' && (globalThis as any).netlify?.cache) {
        const cacheData = {
          data,
          timestamp: Date.now(),
          ttl: config.ttl,
          tags: config.tags
        };
        
        await (globalThis as any).netlify.cache.set(key, JSON.stringify(cacheData), {
          ttl: config.ttl
        });
      }
    } catch (error) {
      console.error('Edge cache set error:', error);
    }
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      // In a real implementation, this would use Netlify's cache invalidation API
      if (typeof globalThis !== 'undefined' && (globalThis as any).netlify?.cache) {
        // Netlify Edge Functions would have a different API for tag-based invalidation
        console.log('Edge cache invalidation for tags:', tags);
        return 0; // Would return actual count
      }
      return 0;
    } catch (error) {
      console.error('Edge cache invalidation error:', error);
      return 0;
    }
  }

  getStats(): CacheStats {
    return {
      tier: 'edge',
      size: 0, // Would be provided by edge runtime
      maxSize: 0, // Edge cache limits are platform-specific
      hitRate: this.hits / (this.hits + this.misses) || 0,
      hits: this.hits,
      misses: this.misses,
      evictions: 0, // Managed by edge runtime
      totalRequests: this.hits + this.misses
    };
  }
}

/**
 * Database cache implementation using Supabase
 */
class DatabaseCache {
  private hits = 0;
  private misses = 0;

  async get<T>(key: string): Promise<T | null> {
    try {
      const client = supabaseServer();
      
      const { data, error } = await client
        .from('cache_entries')
        .select('data, expires_at')
        .eq('key', key)
        .single();

      if (error || !data) {
        this.misses++;
        return null;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        // Clean up expired entry
        await client.from('cache_entries').delete().eq('key', key);
        this.misses++;
        return null;
      }

      this.hits++;
      return JSON.parse(data.data) as T;
    } catch (error) {
      console.error('Database cache get error:', error);
      this.misses++;
      return null;
    }
  }

  async set<T>(key: string, data: T, config: CacheConfig): Promise<void> {
    try {
      const client = supabaseServer();
      const expiresAt = new Date(Date.now() + config.ttl * 1000);

      await client
        .from('cache_entries')
        .upsert({
          key,
          data: JSON.stringify(data),
          tags: config.tags,
          expires_at: expiresAt.toISOString(),
          created_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Database cache set error:', error);
    }
  }

  async invalidateByTags(tags: string[]): Promise<number> {
    try {
      const client = supabaseServer();
      
      const { data, error } = await client
        .from('cache_entries')
        .delete()
        .overlaps('tags', tags)
        .select('key');

      if (error) {
        console.error('Database cache invalidation error:', error);
        return 0;
      }

      return data?.length || 0;
    } catch (error) {
      console.error('Database cache invalidation error:', error);
      return 0;
    }
  }

  async cleanup(): Promise<void> {
    try {
      const client = supabaseServer();
      
      // Remove expired entries
      await client
        .from('cache_entries')
        .delete()
        .lt('expires_at', new Date().toISOString());
    } catch (error) {
      console.error('Database cache cleanup error:', error);
    }
  }

  getStats(): CacheStats {
    return {
      tier: 'database',
      size: 0, // Would need separate query to get count
      maxSize: 0, // Database-dependent
      hitRate: this.hits / (this.hits + this.misses) || 0,
      hits: this.hits,
      misses: this.misses,
      evictions: 0, // Handled by cleanup
      totalRequests: this.hits + this.misses
    };
  }
}

/**
 * Multi-tier cache manager
 */
export class CacheManager {
  private memoryCache: MemoryCache;
  private edgeCache: EdgeCache;
  private databaseCache: DatabaseCache;

  constructor(memoryCacheSize: number = 1000) {
    this.memoryCache = new MemoryCache(memoryCacheSize);
    this.edgeCache = new EdgeCache();
    this.databaseCache = new DatabaseCache();

    // Setup periodic cleanup
    setInterval(() => {
      this.cleanup();
    }, 5 * 60 * 1000); // Every 5 minutes
  }

  /**
   * Get data from cache with tier fallback
   */
  async get<T>(key: string, config: CacheConfig): Promise<T | null> {
    switch (config.strategy) {
      case 'memory':
        return this.memoryCache.get<T>(key);
        
      case 'edge':
        // Try memory first, then edge
        let result = this.memoryCache.get<T>(key);
        if (result !== null) return result;
        
        result = await this.edgeCache.get<T>(key);
        if (result !== null) {
          // Populate memory cache
          this.memoryCache.set(key, result, config);
        }
        return result;
        
      case 'database':
        // Try memory, then edge, then database
        result = this.memoryCache.get<T>(key);
        if (result !== null) return result;
        
        result = await this.edgeCache.get<T>(key);
        if (result !== null) {
          this.memoryCache.set(key, result, config);
          return result;
        }
        
        result = await this.databaseCache.get<T>(key);
        if (result !== null) {
          this.memoryCache.set(key, result, config);
          await this.edgeCache.set(key, result, config);
        }
        return result;
        
      case 'none':
      default:
        return null;
    }
  }

  /**
   * Set data in cache
   */
  async set<T>(key: string, data: T, config: CacheConfig): Promise<void> {
    switch (config.strategy) {
      case 'memory':
        this.memoryCache.set(key, data, config);
        break;
        
      case 'edge':
        this.memoryCache.set(key, data, config);
        await this.edgeCache.set(key, data, config);
        break;
        
      case 'database':
        this.memoryCache.set(key, data, config);
        await this.edgeCache.set(key, data, config);
        await this.databaseCache.set(key, data, config);
        break;
        
      case 'none':
      default:
        // No caching
        break;
    }
  }

  /**
   * Invalidate cache by tags
   */
  async invalidateByTags(tags: string[]): Promise<{ memory: number; edge: number; database: number }> {
    const results = {
      memory: this.memoryCache.invalidateByTags(tags),
      edge: await this.edgeCache.invalidateByTags(tags),
      database: await this.databaseCache.invalidateByTags(tags)
    };

    console.log(`Cache invalidation for tags [${tags.join(', ')}]:`, results);
    return results;
  }

  /**
   * Invalidate cache by pattern
   */
  invalidateByPattern(pattern: RegExp): number {
    return this.memoryCache.invalidateByPattern(pattern);
  }

  /**
   * Clear all caches
   */
  clear(): void {
    this.memoryCache.clear();
    // Edge and database caches would need separate clearing logic
  }

  /**
   * Get comprehensive cache statistics
   */
  getStats(): { memory: CacheStats; edge: CacheStats; database: CacheStats } {
    return {
      memory: this.memoryCache.getStats(),
      edge: this.edgeCache.getStats(),
      database: this.databaseCache.getStats()
    };
  }

  /**
   * Cleanup expired entries and optimize cache
   */
  private async cleanup(): Promise<void> {
    try {
      await this.databaseCache.cleanup();
    } catch (error) {
      console.error('Cache cleanup error:', error);
    }
  }

  /**
   * Warm cache with frequently accessed data
   */
  async warmCache(warmupData: Array<{ key: string; data: any; config: CacheConfig }>): Promise<void> {
    const promises = warmupData.map(({ key, data, config }) => 
      this.set(key, data, config)
    );
    
    await Promise.all(promises);
    console.log(`Cache warmed with ${warmupData.length} entries`);
  }

  /**
   * Get cache entry details for monitoring
   */
  getCacheEntries(): Array<{ key: string; entry: any; tier: string }> {
    return this.memoryCache.getEntries().map(({ key, entry }) => ({
      key,
      entry,
      tier: 'memory'
    }));
  }
}

// Global cache manager instance
export const cacheManager = new CacheManager();

/**
 * Cache configuration presets for common use cases
 */
export const CACHE_PRESETS = {
  // Static data that rarely changes
  STATIC: {
    strategy: 'database' as CacheTier,
    ttl: 3600, // 1 hour
    tags: ['static'] as string[],
    staleWhileRevalidate: 600 // 10 minutes
  },
  
  // Dynamic data that changes frequently
  DYNAMIC: {
    strategy: 'memory' as CacheTier,
    ttl: 300, // 5 minutes
    tags: ['dynamic'] as string[],
    staleWhileRevalidate: 60 // 1 minute
  },
  
  // User-specific data
  USER_SPECIFIC: {
    strategy: 'memory' as CacheTier,
    ttl: 600, // 10 minutes
    tags: ['user'] as string[],
    staleWhileRevalidate: 120 // 2 minutes
  },
  
  // Configuration data
  CONFIG: {
    strategy: 'edge' as CacheTier,
    ttl: 1800, // 30 minutes
    tags: ['config'] as string[],
    staleWhileRevalidate: 300 // 5 minutes
  },
  
  // Exam data
  EXAM_DATA: {
    strategy: 'edge' as CacheTier,
    ttl: 900, // 15 minutes
    tags: ['exam'] as string[],
    staleWhileRevalidate: 180 // 3 minutes
  }
};

/**
 * Enhanced cache manager with intelligent strategies
 */
export class IntelligentCacheManager extends CacheManager {
  /**
   * Get data with intelligent strategy selection
   */
  async getWithStrategy<T>(
    dataType: string,
    params: any,
    dataFetcher: () => Promise<T>,
    context?: any
  ): Promise<T> {
    // Import here to avoid circular dependency
    const { CacheStrategySelector } = await import('./cache-strategies');
    const { CacheAnalyticsCollector } = await import('./cache-analytics');
    
    const strategy = CacheStrategySelector.selectStrategy(dataType, context);
    const cacheKey = strategy.keyGenerator(params);
    
    const startTime = Date.now();
    
    try {
      // Try cache first
      const cached = await this.get<T>(cacheKey, strategy.config);
      if (cached !== null) {
        CacheAnalyticsCollector.recordOperation(
          cacheKey,
          'hit',
          Date.now() - startTime,
          dataType,
          JSON.stringify(cached).length,
          strategy.config.ttl,
          strategy.config.tags
        );
        return cached;
      }

      // Cache miss - fetch data
      const data = await dataFetcher();
      
      // Check if we should cache this data
      if (strategy.shouldCache(data, context)) {
        await this.set(cacheKey, data, strategy.config);
      }
      
      CacheAnalyticsCollector.recordOperation(
        cacheKey,
        'miss',
        Date.now() - startTime,
        dataType,
        JSON.stringify(data).length,
        strategy.config.ttl,
        strategy.config.tags
      );
      
      return data;
    } catch (error) {
      CacheAnalyticsCollector.recordOperation(
        cacheKey,
        'miss',
        Date.now() - startTime,
        dataType,
        0,
        strategy.config.ttl,
        strategy.config.tags
      );
      throw error;
    }
  }

  /**
   * Batch get with intelligent strategies
   */
  async batchGetWithStrategy<T>(
    requests: Array<{
      dataType: string;
      params: any;
      dataFetcher: () => Promise<T>;
      context?: any;
    }>
  ): Promise<T[]> {
    const results = await Promise.all(
      requests.map(req => 
        this.getWithStrategy(req.dataType, req.params, req.dataFetcher, req.context)
      )
    );
    
    return results;
  }
}

// Enhanced global cache manager instance
export const intelligentCacheManager = new IntelligentCacheManager();