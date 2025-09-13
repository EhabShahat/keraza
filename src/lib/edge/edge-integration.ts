/**
 * Edge Function Integration Utilities
 * Provides utilities for integrating with Netlify Edge Functions
 */

/**
 * Edge function endpoints
 */
export const EDGE_ENDPOINTS = {
  validateToken: '/api/edge/validate-token',
  invalidateAuth: '/api/edge/invalidate-auth',
  invalidateConfig: '/api/edge/invalidate-config',
  cacheStats: '/api/edge/cache/stats',
  invalidateCache: '/api/edge/cache/invalidate'
} as const;

/**
 * Configuration for edge-cached endpoints
 */
export const EDGE_CACHED_ENDPOINTS = {
  systemMode: '/api/public/system-mode',
  settings: '/api/public/settings',
  codeSettings: '/api/public/code-settings',
  activeExam: '/api/public/active-exam'
} as const;

/**
 * Edge function client for server-side operations
 */
export class EdgeFunctionClient {
  private baseUrl: string;

  constructor(baseUrl?: string) {
    this.baseUrl = baseUrl || (typeof window !== 'undefined' ? window.location.origin : '');
  }

  /**
   * Validate authentication token using edge function
   */
  async validateToken(token: string, includeUser: boolean = false): Promise<{
    valid: boolean;
    error?: string;
    user?: {
      id: string;
      email: string;
      role: string;
    };
  }> {
    try {
      const url = new URL(EDGE_ENDPOINTS.validateToken, this.baseUrl);
      if (includeUser) {
        url.searchParams.set('include_user', 'true');
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      return await response.json();
    } catch (error) {
      return {
        valid: false,
        error: `Edge validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Invalidate authentication cache
   */
  async invalidateAuthCache(pattern?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}${EDGE_ENDPOINTS.invalidateAuth}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pattern })
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: `Auth cache invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Invalidate configuration cache
   */
  async invalidateConfigCache(pattern?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}${EDGE_ENDPOINTS.invalidateConfig}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pattern })
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: `Config cache invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Get cache statistics
   */
  async getCacheStats(): Promise<{
    size: number;
    keys: string[];
    error?: string;
  }> {
    try {
      const response = await fetch(`${this.baseUrl}${EDGE_ENDPOINTS.cacheStats}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      });

      return await response.json();
    } catch (error) {
      return {
        size: 0,
        keys: [],
        error: `Cache stats failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }

  /**
   * Invalidate static content cache
   */
  async invalidateStaticCache(pattern?: string): Promise<{ success: boolean; error?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}${EDGE_ENDPOINTS.invalidateCache}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pattern })
      });

      return await response.json();
    } catch (error) {
      return {
        success: false,
        error: `Static cache invalidation failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Edge-aware fetch utility
 * Automatically uses edge-cached endpoints when available
 */
export async function edgeFetch(
  endpoint: string,
  options: RequestInit = {}
): Promise<Response> {
  // Check if this endpoint is edge-cached
  const isEdgeCached = Object.values(EDGE_CACHED_ENDPOINTS).includes(endpoint as any);
  
  if (isEdgeCached) {
    // Add headers to indicate edge preference
    const headers = new Headers(options.headers);
    headers.set('X-Edge-Preferred', 'true');
    
    options.headers = headers;
  }
  
  return fetch(endpoint, options);
}

/**
 * Edge cache invalidation helper
 */
export class EdgeCacheManager {
  private client: EdgeFunctionClient;

  constructor(baseUrl?: string) {
    this.client = new EdgeFunctionClient(baseUrl);
  }

  /**
   * Invalidate all caches related to system configuration
   */
  async invalidateSystemConfig(): Promise<void> {
    await Promise.all([
      this.client.invalidateConfigCache('system'),
      this.client.invalidateStaticCache('/api/public/system-mode'),
      this.client.invalidateStaticCache('/api/public/settings')
    ]);
  }

  /**
   * Invalidate all caches related to exam configuration
   */
  async invalidateExamConfig(): Promise<void> {
    await Promise.all([
      this.client.invalidateConfigCache('exam'),
      this.client.invalidateStaticCache('/api/public/active-exam'),
      this.client.invalidateStaticCache('/api/public/exams')
    ]);
  }

  /**
   * Invalidate authentication caches
   */
  async invalidateAuth(userId?: string): Promise<void> {
    const pattern = userId ? userId : undefined;
    await this.client.invalidateAuthCache(pattern);
  }

  /**
   * Invalidate all caches (nuclear option)
   */
  async invalidateAll(): Promise<void> {
    await Promise.all([
      this.client.invalidateAuthCache(),
      this.client.invalidateConfigCache(),
      this.client.invalidateStaticCache()
    ]);
  }

  /**
   * Get comprehensive cache statistics
   */
  async getStats(): Promise<{
    static: { size: number; keys: string[] };
    error?: string;
  }> {
    try {
      const staticStats = await this.client.getCacheStats();
      
      return {
        static: {
          size: staticStats.size,
          keys: staticStats.keys
        },
        error: staticStats.error
      };
    } catch (error) {
      return {
        static: { size: 0, keys: [] },
        error: `Stats collection failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      };
    }
  }
}

/**
 * Middleware for Next.js API routes to work with edge functions
 */
export function withEdgeIntegration<T extends any[]>(
  handler: (...args: T) => Promise<Response>
) {
  return async (...args: T): Promise<Response> => {
    const response = await handler(...args);
    
    // Add headers to indicate edge compatibility
    response.headers.set('X-Edge-Compatible', 'true');
    
    // Add cache tags for edge invalidation
    const url = args[0] instanceof Request ? new URL(args[0].url) : null;
    if (url) {
      const pathname = url.pathname;
      
      if (pathname.includes('/api/public/')) {
        response.headers.set('Cache-Tag', 'public,api');
      }
      
      if (pathname.includes('/system-mode')) {
        response.headers.set('Cache-Tag', 'system,config');
      }
      
      if (pathname.includes('/settings')) {
        response.headers.set('Cache-Tag', 'settings,config');
      }
      
      if (pathname.includes('/exam')) {
        response.headers.set('Cache-Tag', 'exam,content');
      }
    }
    
    return response;
  };
}

/**
 * Hook for React components to use edge functions
 */
export function useEdgeFunction(baseUrl?: string) {
  const client = new EdgeFunctionClient(baseUrl);
  const cacheManager = new EdgeCacheManager(baseUrl);
  
  return {
    validateToken: client.validateToken.bind(client),
    invalidateAuth: cacheManager.invalidateAuth.bind(cacheManager),
    invalidateSystemConfig: cacheManager.invalidateSystemConfig.bind(cacheManager),
    invalidateExamConfig: cacheManager.invalidateExamConfig.bind(cacheManager),
    getCacheStats: cacheManager.getStats.bind(cacheManager),
    edgeFetch
  };
}

/**
 * Default edge function client instance
 */
export const edgeClient = new EdgeFunctionClient();
export const edgeCacheManager = new EdgeCacheManager();