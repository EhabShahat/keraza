/**
 * Netlify Edge Function for Configuration Data and System Settings
 * Handles static configuration data at the edge for optimal performance
 */

import type { Context } from "https://edge.netlify.com";

interface SystemMode {
  mode: "exam" | "results" | "disabled";
  message: string | null;
}

interface AppSettings {
  brand_name?: string;
  brand_logo_url?: string;
  default_language?: string;
  welcome_instructions?: string;
  welcome_instructions_ar?: string;
  thank_you_title?: string;
  thank_you_title_ar?: string;
  thank_you_message?: string;
  thank_you_message_ar?: string;
  enable_name_search?: boolean;
  enable_code_search?: boolean;
}

interface CodeSettings {
  code_length: number;
  code_format: "numeric" | "alphanumeric" | "alphabetic";
  code_pattern: string | null;
}

/**
 * Edge-optimized configuration cache
 */
class EdgeConfigCache {
  private static readonly CACHE_TTL = 300; // 5 minutes
  private static cache = new Map<string, { data: any; timestamp: number; ttl: number }>();

  static get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    if (!entry) return null;

    const now = Date.now();
    if (now - entry.timestamp > entry.ttl * 1000) {
      this.cache.delete(key);
      return null;
    }

    return entry.data as T;
  }

  static set<T>(key: string, data: T, ttl: number = this.CACHE_TTL): void {
    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl
    });
  }

  static clear(): void {
    this.cache.clear();
  }

  static invalidate(pattern: string): void {
    for (const key of this.cache.keys()) {
      if (key.includes(pattern)) {
        this.cache.delete(key);
      }
    }
  }
}

/**
 * Fetch configuration from origin with caching
 */
async function fetchWithCache<T>(
  url: string,
  cacheKey: string,
  ttl: number = 300
): Promise<T | null> {
  // Try cache first
  const cached = EdgeConfigCache.get<T>(cacheKey);
  if (cached) {
    return cached;
  }

  try {
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Netlify-Edge-Function',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json() as T;
    EdgeConfigCache.set(cacheKey, data, ttl);
    return data;
  } catch (error) {
    console.error(`Failed to fetch ${cacheKey}:`, error);
    return null;
  }
}

/**
 * Get system mode configuration
 */
async function getSystemMode(origin: string): Promise<SystemMode> {
  const defaultMode: SystemMode = { mode: "exam", message: null };
  
  try {
    const data = await fetchWithCache<SystemMode>(
      `${origin}/api/public/system-mode`,
      'system-mode',
      300 // 5 minutes
    );
    
    return data || defaultMode;
  } catch (error) {
    console.error('Error fetching system mode:', error);
    return defaultMode;
  }
}

/**
 * Get application settings
 */
async function getAppSettings(origin: string): Promise<AppSettings> {
  const defaultSettings: AppSettings = {};
  
  try {
    const data = await fetchWithCache<AppSettings>(
      `${origin}/api/public/settings`,
      'app-settings',
      1800 // 30 minutes
    );
    
    return data || defaultSettings;
  } catch (error) {
    console.error('Error fetching app settings:', error);
    return defaultSettings;
  }
}

/**
 * Get code format settings
 */
async function getCodeSettings(origin: string): Promise<CodeSettings> {
  const defaultSettings: CodeSettings = {
    code_length: 4,
    code_format: "numeric",
    code_pattern: null
  };
  
  try {
    const data = await fetchWithCache<CodeSettings>(
      `${origin}/api/public/code-settings`,
      'code-settings',
      900 // 15 minutes
    );
    
    return data || defaultSettings;
  } catch (error) {
    console.error('Error fetching code settings:', error);
    return defaultSettings;
  }
}

/**
 * Create cache headers for responses
 */
function createCacheHeaders(maxAge: number): Record<string, string> {
  const swr = Math.floor(maxAge * 0.1); // 10% of max-age for stale-while-revalidate
  
  return {
    'Cache-Control': `public, max-age=${maxAge}, stale-while-revalidate=${swr}`,
    'CDN-Cache-Control': `public, max-age=${maxAge}`,
    'Netlify-CDN-Cache-Control': `public, max-age=${maxAge}`,
    'Vary': 'Accept-Encoding, Accept-Language',
    'X-Edge-Cache': 'HIT'
  };
}

/**
 * Main edge function handler
 */
export default async (request: Request, context: Context) => {
  const url = new URL(request.url);
  const pathname = url.pathname;
  
  // Only handle GET requests
  if (request.method !== 'GET') {
    return context.next();
  }

  // Extract the origin for API calls
  const origin = `${url.protocol}//${url.host}`;
  
  try {
    // Handle different configuration endpoints
    if (pathname === '/api/public/system-mode') {
      const data = await getSystemMode(origin);
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...createCacheHeaders(300), // 5 minutes
          'X-Edge-Function': 'config-handler'
        }
      });
    }
    
    if (pathname === '/api/public/settings') {
      const data = await getAppSettings(origin);
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...createCacheHeaders(1800), // 30 minutes
          'X-Edge-Function': 'config-handler'
        }
      });
    }
    
    if (pathname === '/api/public/code-settings') {
      const data = await getCodeSettings(origin);
      
      return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
          'Content-Type': 'application/json',
          ...createCacheHeaders(900), // 15 minutes
          'X-Edge-Function': 'config-handler'
        }
      });
    }
    
    // Handle cache invalidation requests
    if (pathname === '/api/edge/invalidate-config' && request.method === 'POST') {
      try {
        const body = await request.json();
        const { pattern } = body;
        
        if (pattern) {
          EdgeConfigCache.invalidate(pattern);
        } else {
          EdgeConfigCache.clear();
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
    
  } catch (error) {
    console.error('Edge function error:', error);
    
    // Return error response but don't block the request
    return new Response(JSON.stringify({ 
      error: 'Edge function error',
      fallback: true 
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'X-Edge-Error': 'true'
      }
    });
  }
  
  // Pass through to origin for unhandled paths
  return context.next();
};

/**
 * Edge function configuration
 */
export const config = {
  path: [
    "/api/public/system-mode",
    "/api/public/settings", 
    "/api/public/code-settings",
    "/api/edge/invalidate-config"
  ],
  cache: "manual"
};