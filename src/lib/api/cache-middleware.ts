import { NextRequest, NextResponse } from "next/server";
import { cacheInvalidation } from "./public-cache";

/**
 * Cache invalidation middleware for public API endpoints
 * Automatically invalidates relevant cache entries when data changes
 */
export interface CacheInvalidationConfig {
  triggers: {
    [key: string]: string[]; // Route pattern -> cache tags to invalidate
  };
}

/**
 * Default cache invalidation configuration
 */
export const DEFAULT_CACHE_INVALIDATION: CacheInvalidationConfig = {
  triggers: {
    // Admin routes that affect public data
    "/api/admin/exams": ["exams", "active"],
    "/api/admin/settings": ["settings", "config"],
    "/api/admin/system": ["system", "config"],
    "/api/admin/students": ["student"],
    
    // Specific exam updates
    "/api/admin/exams/[examId]": ["exam-{examId}", "exams", "active"],
    
    // System configuration updates
    "/api/admin/system-mode": ["system", "config"],
    "/api/admin/app-config": ["system", "config", "settings"]
  }
};

/**
 * Middleware to handle cache invalidation based on route patterns
 */
export function createCacheInvalidationMiddleware(config: CacheInvalidationConfig = DEFAULT_CACHE_INVALIDATION) {
  return {
    name: 'cache-invalidation',
    handler: async (request: any): Promise<any> => {
      // Only process POST, PUT, PATCH, DELETE requests that might modify data
      if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(request.method)) {
        return request;
      }

      // Store original request for post-processing
      (request as any).cacheInvalidationConfig = config;
      
      return request;
    }
  };
}

/**
 * Post-response cache invalidation
 * Call this after successful data modifications
 */
export function invalidateCacheForRoute(route: string, examId?: string, studentCode?: string) {
  const config = DEFAULT_CACHE_INVALIDATION;
  
  // Find matching trigger patterns
  for (const [pattern, tags] of Object.entries(config.triggers)) {
    if (matchesRoutePattern(route, pattern)) {
      // Replace dynamic segments in tags
      const processedTags = tags.map(tag => {
        if (examId && tag.includes('{examId}')) {
          return tag.replace('{examId}', examId);
        }
        if (studentCode && tag.includes('{studentCode}')) {
          return tag.replace('{studentCode}', studentCode);
        }
        return tag;
      });
      
      console.log(`Invalidating cache tags for route ${route}:`, processedTags);
      cacheInvalidation.invalidateByTags(processedTags);
    }
  }
}

/**
 * Check if a route matches a pattern
 */
function matchesRoutePattern(route: string, pattern: string): boolean {
  // Convert pattern to regex
  const regexPattern = pattern
    .replace(/\[([^\]]+)\]/g, '([^/]+)') // Replace [param] with capture group
    .replace(/\//g, '\\/'); // Escape forward slashes
  
  const regex = new RegExp(`^${regexPattern}$`);
  return regex.test(route);
}

/**
 * Edge caching utilities for static public data
 */
export class EdgeCacheManager {
  private static readonly EDGE_CACHE_HEADERS = {
    // Cache for 5 minutes at edge, revalidate every minute
    'Cache-Control': 'public, max-age=300, s-maxage=300, stale-while-revalidate=60',
    'CDN-Cache-Control': 'public, max-age=300',
    'Vercel-CDN-Cache-Control': 'public, max-age=300'
  };

  private static readonly LONG_CACHE_HEADERS = {
    // Cache for 1 hour at edge, revalidate every 10 minutes
    'Cache-Control': 'public, max-age=3600, s-maxage=3600, stale-while-revalidate=600',
    'CDN-Cache-Control': 'public, max-age=3600',
    'Vercel-CDN-Cache-Control': 'public, max-age=3600'
  };

  private static readonly SHORT_CACHE_HEADERS = {
    // Cache for 1 minute at edge, revalidate every 30 seconds
    'Cache-Control': 'public, max-age=60, s-maxage=60, stale-while-revalidate=30',
    'CDN-Cache-Control': 'public, max-age=60',
    'Vercel-CDN-Cache-Control': 'public, max-age=60'
  };

  /**
   * Add edge caching headers to response based on endpoint type
   */
  static addCacheHeaders(response: NextResponse, endpoint: string): NextResponse {
    let headers: Record<string, string>;

    switch (endpoint) {
      case 'system-mode':
      case 'active-exam':
        // Frequently changing data - short cache
        headers = this.SHORT_CACHE_HEADERS;
        break;
        
      case 'code-settings':
      case 'settings':
        // Rarely changing data - long cache
        headers = this.LONG_CACHE_HEADERS;
        break;
        
      case 'exam-info':
        // Moderately changing data - medium cache
        headers = this.EDGE_CACHE_HEADERS;
        break;
        
      default:
        // Default caching
        headers = this.EDGE_CACHE_HEADERS;
    }

    // Add cache headers
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Add cache tags for Vercel
    const cacheTag = this.getCacheTag(endpoint);
    if (cacheTag) {
      response.headers.set('Cache-Tag', cacheTag);
    }

    return response;
  }

  /**
   * Get cache tag for endpoint
   */
  private static getCacheTag(endpoint: string): string {
    const tagMap: Record<string, string> = {
      'system-mode': 'system,config',
      'settings': 'settings,config',
      'code-settings': 'code,settings',
      'active-exam': 'exams,active',
      'exam-info': 'exam,info',
      'results': 'results,search',
      'validate-code': 'validation,code',
      'exams-by-code': 'exams,student'
    };

    return tagMap[endpoint] || 'public';
  }

  /**
   * Create cache key for endpoint with parameters
   */
  static createCacheKey(endpoint: string, params: Record<string, string> = {}): string {
    const baseKey = `public:${endpoint}`;
    
    if (Object.keys(params).length === 0) {
      return baseKey;
    }

    const paramString = Object.entries(params)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, value]) => `${key}=${value}`)
      .join('&');

    return `${baseKey}:${paramString}`;
  }

  /**
   * Purge edge cache for specific tags
   */
  static async purgeEdgeCache(tags: string[]): Promise<void> {
    // This would integrate with your CDN's purge API
    // For Vercel, you'd use their Edge Config API
    // For Cloudflare, you'd use their Cache API
    
    console.log('Purging edge cache for tags:', tags);
    
    // Example implementation for Vercel
    if (process.env.VERCEL_TOKEN && process.env.VERCEL_TEAM_ID) {
      try {
        const response = await fetch(`https://api.vercel.com/v1/edge-config/${process.env.VERCEL_EDGE_CONFIG_ID}/items`, {
          method: 'PATCH',
          headers: {
            'Authorization': `Bearer ${process.env.VERCEL_TOKEN}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            items: tags.map(tag => ({
              operation: 'delete',
              key: tag
            }))
          })
        });

        if (!response.ok) {
          console.error('Failed to purge Vercel edge cache:', await response.text());
        }
      } catch (error) {
        console.error('Error purging Vercel edge cache:', error);
      }
    }
  }
}

/**
 * Response wrapper that adds appropriate caching headers
 */
export function createCachedResponse(data: any, endpoint: string, status: number = 200): NextResponse {
  const response = NextResponse.json(data, { status });
  return EdgeCacheManager.addCacheHeaders(response, endpoint);
}

/**
 * Middleware to add cache headers to public API responses
 */
export function createCacheHeaderMiddleware() {
  return {
    name: 'cache-headers',
    handler: async (request: any): Promise<any> => {
      // Store endpoint info for response processing
      const pathSegments = request.path || [];
      let endpoint = pathSegments[0] || 'unknown';
      
      // Handle nested endpoints
      if (pathSegments.length > 1) {
        if (pathSegments[0] === 'exams' && pathSegments[2] === 'info') {
          endpoint = 'exam-info';
        } else if (pathSegments[0] === 'exams' && pathSegments[1] === 'by-code') {
          endpoint = 'exams-by-code';
        }
      }
      
      (request as any).cacheEndpoint = endpoint;
      return request;
    }
  };
}