/**
 * Static Content Fallback System
 * Provides fallback mechanisms when static generation fails
 */

import { readFile } from "fs/promises";
import { join } from "path";

/**
 * Fallback data for when static generation fails
 */
export const FALLBACK_DATA = {
  systemMode: {
    mode: "exam" as const,
    message: null,
    fallback: true
  },
  appSettings: {
    brand_name: "Exam Application",
    default_language: "en",
    fallback: true
  },
  codeSettings: {
    code_length: 4,
    code_format: "numeric" as const,
    code_pattern: null,
    fallback: true
  },
  activeExams: {
    exams: [],
    fallback: true
  }
} as const;

/**
 * Static content cache for runtime fallbacks
 */
class StaticContentCache {
  private static cache = new Map<string, any>();
  private static lastUpdate = new Map<string, number>();
  private static readonly CACHE_TTL = 300000; // 5 minutes

  static async get<T>(key: string): Promise<T | null> {
    const cached = this.cache.get(key);
    const lastUpdate = this.lastUpdate.get(key) || 0;
    
    // Check if cache is still valid
    if (cached && Date.now() - lastUpdate < this.CACHE_TTL) {
      return cached as T;
    }
    
    // Try to load from static files
    try {
      const staticContent = await this.loadStaticFile(key);
      if (staticContent) {
        this.set(key, staticContent);
        return staticContent as T;
      }
    } catch (error) {
      console.warn(`Failed to load static content for ${key}:`, error);
    }
    
    return null;
  }

  static set<T>(key: string, data: T): void {
    this.cache.set(key, data);
    this.lastUpdate.set(key, Date.now());
  }

  static clear(): void {
    this.cache.clear();
    this.lastUpdate.clear();
  }

  private static async loadStaticFile(key: string): Promise<any> {
    try {
      const staticDir = join(process.cwd(), ".next", "static-content");
      const filePath = join(staticDir, `${key}.json`);
      const content = await readFile(filePath, "utf-8");
      return JSON.parse(content);
    } catch (error) {
      // File doesn't exist or can't be read
      return null;
    }
  }
}

/**
 * Get static content with fallback
 */
export async function getStaticContentWithFallback<T>(
  key: keyof typeof FALLBACK_DATA,
  generator?: () => Promise<T>
): Promise<T> {
  try {
    // Try to get from cache first
    const cached = await StaticContentCache.get<T>(key);
    if (cached) {
      return cached;
    }

    // Try to generate fresh content
    if (generator) {
      try {
        const generated = await generator();
        StaticContentCache.set(key, generated);
        return generated;
      } catch (error) {
        console.warn(`Content generation failed for ${key}:`, error);
      }
    }

    // Fall back to static fallback data
    console.log(`Using fallback data for ${key}`);
    return FALLBACK_DATA[key] as T;
    
  } catch (error) {
    console.error(`All fallback mechanisms failed for ${key}:`, error);
    return FALLBACK_DATA[key] as T;
  }
}

/**
 * Preload static content into cache
 */
export async function preloadStaticContent(): Promise<void> {
  const keys = Object.keys(FALLBACK_DATA) as Array<keyof typeof FALLBACK_DATA>;
  
  await Promise.all(
    keys.map(async (key) => {
      try {
        await StaticContentCache.get(key);
      } catch (error) {
        console.warn(`Failed to preload ${key}:`, error);
      }
    })
  );
}

/**
 * Health check for static content system
 */
export async function checkStaticContentHealth(): Promise<{
  status: 'healthy' | 'degraded' | 'unhealthy';
  details: Record<string, any>;
}> {
  const keys = Object.keys(FALLBACK_DATA) as Array<keyof typeof FALLBACK_DATA>;
  const results: Record<string, any> = {};
  
  let healthyCount = 0;
  let totalCount = keys.length;
  
  for (const key of keys) {
    try {
      const content = await StaticContentCache.get(key);
      const isHealthy = content && !content.fallback;
      
      results[key] = {
        available: !!content,
        isFallback: content?.fallback || false,
        healthy: isHealthy
      };
      
      if (isHealthy) {
        healthyCount++;
      }
    } catch (error) {
      results[key] = {
        available: false,
        isFallback: true,
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }
  
  let status: 'healthy' | 'degraded' | 'unhealthy';
  const healthRatio = healthyCount / totalCount;
  
  if (healthRatio >= 0.8) {
    status = 'healthy';
  } else if (healthRatio >= 0.5) {
    status = 'degraded';
  } else {
    status = 'unhealthy';
  }
  
  return {
    status,
    details: {
      healthyCount,
      totalCount,
      healthRatio,
      results
    }
  };
}

/**
 * Invalidate static content cache
 */
export function invalidateStaticContent(key?: keyof typeof FALLBACK_DATA): void {
  if (key) {
    StaticContentCache.cache.delete(key);
    StaticContentCache.lastUpdate.delete(key);
  } else {
    StaticContentCache.clear();
  }
}

/**
 * Get cache statistics
 */
export function getStaticContentStats(): {
  cacheSize: number;
  keys: string[];
  lastUpdates: Record<string, number>;
} {
  return {
    cacheSize: StaticContentCache.cache.size,
    keys: Array.from(StaticContentCache.cache.keys()),
    lastUpdates: Object.fromEntries(StaticContentCache.lastUpdate.entries())
  };
}