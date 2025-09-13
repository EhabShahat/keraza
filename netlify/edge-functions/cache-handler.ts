/**
 * Netlify Edge Function for edge caching
 * Handles caching at the edge for optimal performance
 */

import type { Context } from "https://edge.netlify.com";

interface EdgeCacheEntry {
  data: any;
  timestamp: number;
  ttl: number;
  tags: string[];
}

interface CacheConfig {
  strategy: 'memory' | 'edge' | 'database' | 'none';
  ttl: number;
  tags: string[];
  staleWhileRevalidate?: number;
}

/**
 * Edge cache implementation using Netlify's edge runtime
 */
class NetlifyEdgeCache {
  private static readonly CACHE_PREFIX = 'cache:';
  
  /**
   * Get cached data from edge storage
   */
  static async get<T>(key: string, context: Context): Promise<T | null> {
    try {
      const cacheKey = this.CACHE_PREFIX + key;
      
      // Use Netlify's edge cache if available
      if (context.cookies && typeof context.cookies.get === 'function') {
        const cached = context.cookies.get(cacheKey);
        if (cached) {
          const entry: EdgeCacheEntry = JSON.parse(cached);
          
          // Check if expired
          if (Date.now() - entry.timestamp > entry.ttl * 1000) {
            context.cookies.delete(cacheKey);
            return null;
          }
          
          return entry.data as T;
        }
      }
      
      return null;
    } catch (error) {
      console.error('Edge cache get error:', error);
      return null;
    }
  }
  
  /**
   * Set data in edge cache
   */
  static async set<T>(
    key: string, 
    data: T, 
    config: CacheConfig, 
    context: Context
  ): Promise<void> {
    try {
      const cacheKey = this.CACHE_PREFIX + key;
      const entry: EdgeCacheEntry = {
        data,
        timestamp: Date.now(),
        ttl: config.ttl,
        tags: config.tags
      };
      
      // Use Netlify's edge cache if available
      if (context.cookies && typeof context.cookies.set === 'function') {
        context.cookies.set(cacheKey, JSON.stringify(entry), {
          maxAge: config.ttl,
          httpOnly: true,
          secure: true,
          sameSite: 'Strict'
        });
      }
    } catch (error) {
      console.error('Edge cache set error:', error);
    }
  }
  
  /**
   * Create cache headers for HTTP responses
   */
  static createCacheHeaders(config: CacheConfig): Record<string, string> {
    const headers: Record<string, string> = {};
    
    // Set Cache-Control header based on TTL
    const maxAge = config.ttl;
    const swr = config.staleWhileRevalidate || Math.floor(config.ttl * 0.1);
    
    headers['Cache-Control'] = `public, max-age=${maxAge}, stale-while-revalidate=${swr}`;
    
    // Add CDN-specific headers
    headers['CDN-Cache-Control'] = `public, max-age=${maxAge}`;
    headers['Netlify-CDN-Cache-Control'] = `public, max-age=${maxAge}`;
    
    // Add cache tags for invalidation
    if (config.tags.length > 0) {
      headers['Cache-Tag'] = config.tags.join(',');
    }
    
    // Add Vary header for content negotiation
    headers['Vary'] = 'Accept-Encoding, Accept-Language';
    
    return headers;
  }
  
  /**
   * Create cache key from request parameters
   */
  static createCacheKey(
    endpoint: string, 
    params: Record<string, string> = {},
    headers: Record<string, string> = {}
  ): string {
    const baseKey = `edge:${endpoint}`;
    
    // Include relevant headers in cache key
    const relevantHeaders = ['accept-language', 'user-agent'];
    const headerParts = relevantHeaders
      .filter(h => headers[h])
      .map(h => `${h}=${headers[h]}`)
      .join('&');
    
    // Include parameters
    const paramParts = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');
    
    const parts = [baseKey, headerParts, paramParts].filter(Boolean);
    return parts.join(':');
  }
}

/**
 * Cache configuration for different endpoints
 */
const EDGE_CACHE_CONFIGS: Record<string, CacheConfig> = {
  'system-mode': {
    strategy: 'edge',
    ttl: 300, // 5 minutes
    tags: ['system', 'config'],
    staleWhileRevalidate: 60
  },
  'app-settings': {
    strategy: 'edge',
    ttl: 1800, // 30 minutes
    tags: ['settings', 'config'],
    staleWhileRevalidate: 300
  },
  'active-exams': {
    strategy: 'edge',
    ttl: 60, // 1 minute
    tags: ['exams', 'active'],
    staleWhileRevalidate: 30
  },
  'exam-info': {
    strategy: 'edge',
    ttl: 900, // 15 minutes
    tags: ['exam', 'info'],
    staleWhileRevalidate: 180
  }
};

/**
 * Main edge function handler
 */
export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Only handle GET requests for caching
  if (request.method !== 'GET') {
    return context.next();
  }
  
  // Extract endpoint from path
  const pathSegments = pathname.split('/').filter(Boolean);
  if (pathSegments.length < 3 || pathSegments[0] !== 'api' || pathSegments[1] !== 'public') {
    return context.next();
  }
  
  const endpoint = pathSegments[2];
  const config = EDGE_CACHE_CONFIGS[endpoint];
  
  if (!config) {
    return context.next();
  }
  
  // Create cache key
  const params = Object.fromEntries(url.searchParams.entries());
  const headers = Object.fromEntries(request.headers.entries());
  const cacheKey = NetlifyEdgeCache.createCacheKey(endpoint, params, headers);
  
  // Try to get from cache
  const cached = await NetlifyEdgeCache.get(cacheKey, context);
  if (cached) {
    const response = new Response(JSON.stringify(cached), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'X-Cache': 'HIT',
        'X-Cache-Key': cacheKey,
        ...NetlifyEdgeCache.createCacheHeaders(config)
      }
    });
    
    return response;
  }
  
  // Cache miss - forward to origin
  const response = await context.next();
  
  // Cache successful responses
  if (response.status === 200) {
    try {
      const responseClone = response.clone();
      const data = await responseClone.json();
      
      // Store in edge cache
      await NetlifyEdgeCache.set(cacheKey, data, config, context);
      
      // Add cache headers to response
      const cacheHeaders = NetlifyEdgeCache.createCacheHeaders(config);
      Object.entries(cacheHeaders).forEach(([key, value]) => {
        response.headers.set(key, value);
      });
      
      response.headers.set('X-Cache', 'MISS');
      response.headers.set('X-Cache-Key', cacheKey);
      
    } catch (error) {
      console.error('Error caching response:', error);
    }
  }
  
  return response;
};

/**
 * Edge function configuration
 */
export const config = {
  path: "/api/public/*",
  cache: "manual"
};