/**
 * Netlify Edge Function for Static Content and Cached Response Routing
 * Handles routing for static content and cached responses at the edge
 */

import type { Context } from "https://edge.netlify.com";

interface RouteConfig {
  pattern: string;
  cacheStrategy: 'static' | 'dynamic' | 'private';
  ttl: number;
  staleWhileRevalidate?: number;
  headers?: Record<string, string>;
}

interface CachedResponse {
  data: any;
  headers: Record<string, string>;
  status: number;
  timestamp: number;
  ttl: number;
}

/**
 * Edge static content cache
 */
class EdgeStaticCache {
  private static cache = new Map<string, CachedResponse>();

  static get(key: string): CachedResponse | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    const age = now - entry.timestamp;
    
    // Check if expired
    if (age > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  static set(key: string, response: CachedResponse): void {
    this.cache.set(key, {
      ...response,
      timestamp: Date.now()
    });
  }

  static invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern) || key.match(new RegExp(pattern))) {
        this.cache.delete(key);
      }
    }
  }

  static clear(): void {
    this.cache.clear();
  }

  static getStats(): { size: number; keys: string[] } {
    return {
      size: this.cache.size,
      keys: Array.from(this.cache.keys())
    };
  }
}

/**
 * Route configurations for different content types
 */
const ROUTE_CONFIGS: RouteConfig[] = [
  {
    pattern: '/api/public/system-mode',
    cacheStrategy: 'dynamic',
    ttl: 300, // 5 minutes
    staleWhileRevalidate: 60
  },
  {
    pattern: '/api/public/settings',
    cacheStrategy: 'dynamic',
    ttl: 1800, // 30 minutes
    staleWhileRevalidate: 300
  },
  {
    pattern: '/api/public/code-settings',
    cacheStrategy: 'dynamic',
    ttl: 900, // 15 minutes
    staleWhileRevalidate: 180
  },
  {
    pattern: '/api/public/active-exam',
    cacheStrategy: 'dynamic',
    ttl: 60, // 1 minute
    staleWhileRevalidate: 30
  },
  {
    pattern: '/api/public/exams/.*/info',
    cacheStrategy: 'dynamic',
    ttl: 900, // 15 minutes
    staleWhileRevalidate: 180
  },
  {
    pattern: '/favicon.ico',
    cacheStrategy: 'static',
    ttl: 86400, // 24 hours
    headers: {
      'Content-Type': 'image/x-icon'
    }
  },
  {
    pattern: '/.*\\.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)',
    cacheStrategy: 'static',
    ttl: 31536000, // 1 year
    headers: {
      'Cache-Control': 'public, max-age=31536000, immutable'
    }
  }
];

/**
 * Find matching route configuration
 */
function findRouteConfig(pathname: string): RouteConfig | null {
  for (const config of ROUTE_CONFIGS) {
    if (pathname.match(new RegExp(config.pattern))) {
      return config;
    }
  }
  return null;
}

/**
 * Create cache key from request
 */
function createCacheKey(request: Request): string {
  const url = new URL(request.url);
  const pathname = url.pathname;
  const searchParams = url.searchParams.toString();
  
  // Include relevant headers in cache key
  const acceptLanguage = request.headers.get('Accept-Language') || '';
  const userAgent = request.headers.get('User-Agent') || '';
  
  // Create a simple hash of user agent to avoid huge cache keys
  const uaHash = userAgent.length > 0 ? 
    userAgent.split('').reduce((a, b) => ((a << 5) - a + b.charCodeAt(0)) & 0xffffffff, 0).toString(36) : 
    '';
  
  const parts = [pathname, searchParams, acceptLanguage.substring(0, 10), uaHash].filter(Boolean);
  return parts.join(':');
}

/**
 * Create cache headers based on route configuration
 */
function createCacheHeaders(config: RouteConfig, isHit: boolean = false): Record<string, string> {
  const headers: Record<string, string> = {};
  
  // Set cache control based on strategy
  if (config.cacheStrategy === 'static') {
    headers['Cache-Control'] = `public, max-age=${config.ttl}, immutable`;
  } else if (config.cacheStrategy === 'dynamic') {
    const swr = config.staleWhileRevalidate || Math.floor(config.ttl * 0.1);
    headers['Cache-Control'] = `public, max-age=${config.ttl}, stale-while-revalidate=${swr}`;
  } else {
    headers['Cache-Control'] = 'private, no-cache, no-store, must-revalidate';
  }
  
  // Add CDN-specific headers
  if (config.cacheStrategy !== 'private') {
    headers['CDN-Cache-Control'] = `public, max-age=${config.ttl}`;
    headers['Netlify-CDN-Cache-Control'] = `public, max-age=${config.ttl}`;
  }
  
  // Add standard headers
  headers['Vary'] = 'Accept-Encoding, Accept-Language';
  headers['X-Cache'] = isHit ? 'HIT' : 'MISS';
  headers['X-Edge-Function'] = 'static-router';
  
  // Add custom headers from config
  if (config.headers) {
    Object.assign(headers, config.headers);
  }
  
  return headers;
}

/**
 * Fetch and cache response from origin
 */
async function fetchAndCache(
  request: Request, 
  config: RouteConfig, 
  cacheKey: string,
  context: Context
): Promise<Response> {
  try {
    // Fetch from origin
    const response = await context.next();
    
    // Only cache successful responses
    if (response.status === 200 && config.cacheStrategy !== 'private') {
      try {
        const responseClone = response.clone();
        const contentType = response.headers.get('Content-Type') || '';
        
        let data: any;
        if (contentType.includes('application/json')) {
          data = await responseClone.json();
        } else if (contentType.includes('text/')) {
          data = await responseClone.text();
        } else {
          // For binary content, we'll skip caching in this simple implementation
          return response;
        }
        
        // Cache the response
        const cachedResponse: CachedResponse = {
          data,
          headers: Object.fromEntries(response.headers.entries()),
          status: response.status,
          timestamp: Date.now(),
          ttl: config.ttl
        };
        
        EdgeStaticCache.set(cacheKey, cachedResponse);
        
        // Add cache headers
        const cacheHeaders = createCacheHeaders(config, false);
        Object.entries(cacheHeaders).forEach(([key, value]) => {
          response.headers.set(key, value);
        });
        
      } catch (error) {
        console.error('Error caching response:', error);
      }
    }
    
    return response;
    
  } catch (error) {
    console.error('Error fetching from origin:', error);
    
    // Return a generic error response
    return new Response(JSON.stringify({
      error: 'Service temporarily unavailable',
      message: 'Please try again later'
    }), {
      status: 503,
      headers: {
        'Content-Type': 'application/json',
        'X-Edge-Error': 'fetch-failed'
      }
    });
  }
}

/**
 * Create response from cached data
 */
function createCachedResponse(cached: CachedResponse, config: RouteConfig): Response {
  const contentType = cached.headers['content-type'] || 'application/json';
  
  let body: string;
  if (contentType.includes('application/json')) {
    body = JSON.stringify(cached.data);
  } else {
    body = cached.data;
  }
  
  const cacheHeaders = createCacheHeaders(config, true);
  
  return new Response(body, {
    status: cached.status,
    headers: {
      ...cached.headers,
      ...cacheHeaders
    }
  });
}

/**
 * Handle cache management endpoints
 */
async function handleCacheManagement(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  if (pathname === '/api/edge/cache/stats') {
    const stats = EdgeStaticCache.getStats();
    return new Response(JSON.stringify(stats), {
      status: 200,
      headers: {
        'Content-Type': 'application/json'
      }
    });
  }
  
  if (pathname === '/api/edge/cache/invalidate' && request.method === 'POST') {
    try {
      const body = await request.json();
      const { pattern } = body;
      
      if (pattern) {
        EdgeStaticCache.invalidate(pattern);
      } else {
        EdgeStaticCache.clear();
      }
      
      return new Response(JSON.stringify({ success: true }), {
        status: 200,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } catch (error) {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json'
        }
      });
    }
  }
  
  return new Response(JSON.stringify({ error: 'Not found' }), {
    status: 404,
    headers: {
      'Content-Type': 'application/json'
    }
  });
}

/**
 * Main edge function handler
 */
export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Handle cache management endpoints
  if (pathname.startsWith('/api/edge/cache/')) {
    return handleCacheManagement(request);
  }
  
  // Only handle GET requests for caching
  if (request.method !== 'GET') {
    return context.next();
  }
  
  try {
    // Find matching route configuration
    const config = findRouteConfig(pathname);
    if (!config) {
      return context.next();
    }
    
    // Skip caching for private routes
    if (config.cacheStrategy === 'private') {
      return context.next();
    }
    
    // Create cache key
    const cacheKey = createCacheKey(request);
    
    // Try to get from cache
    const cached = EdgeStaticCache.get(cacheKey);
    if (cached) {
      return createCachedResponse(cached, config);
    }
    
    // Cache miss - fetch from origin and cache
    return await fetchAndCache(request, config, cacheKey, context);
    
  } catch (error) {
    console.error('Static router edge function error:', error);
    
    // Pass through to origin on error
    return context.next();
  }
};

/**
 * Edge function configuration
 */
export const config = {
  path: [
    "/api/public/*",
    "/api/edge/cache/*",
    "/favicon.ico",
    "/*.(css|js|png|jpg|jpeg|gif|svg|woff|woff2|ttf|eot)"
  ],
  cache: "manual"
};