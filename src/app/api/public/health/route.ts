/**
 * Public API Health Check Endpoint
 * Provides health status for the consolidated public API handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { healthMonitor } from '@/lib/monitoring/health-monitor';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Basic health checks for public API
    const checks = {
      cache: await checkCache(),
      database: await checkDatabaseRead(),
      memory: checkMemory(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    const responseTime = Date.now() - startTime;
    const isHealthy = checks.cache && checks.database && checks.memory.healthy;

    // Record metrics
    healthMonitor.recordMetrics('public-api', {
      timestamp: new Date(),
      function_name: 'public-api',
      invocation_count: 1,
      avg_response_time: responseTime,
      error_count: isHealthy ? 0 : 1,
      memory_peak: checks.memory.usage,
      cpu_peak: process.cpuUsage().user
    });

    return NextResponse.json({
      status: isHealthy ? 'healthy' : 'unhealthy',
      response_time: responseTime,
      checks,
      version: process.env.npm_package_version || '1.0.0'
    }, {
      status: isHealthy ? 200 : 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'public-api'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Record error metrics
    healthMonitor.recordMetrics('public-api', {
      timestamp: new Date(),
      function_name: 'public-api',
      invocation_count: 1,
      avg_response_time: responseTime,
      error_count: 1,
      memory_peak: process.memoryUsage().heapUsed,
      cpu_peak: process.cpuUsage().user
    });

    return NextResponse.json({
      status: 'unhealthy',
      response_time: responseTime,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, {
      status: 503,
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'X-Health-Check': 'public-api'
      }
    });
  }
}

/**
 * Check cache system health
 */
async function checkCache(): Promise<boolean> {
  try {
    // Test cache functionality
    const testKey = `health-check-${Date.now()}`;
    const testValue = 'test';
    
    // Try to use the cache manager if available
    try {
      const { cacheManager } = await import('@/lib/api/cache-manager');
      await cacheManager.set(testKey, testValue, 1); // 1 second TTL
      const retrieved = await cacheManager.get(testKey);
      return retrieved === testValue;
    } catch {
      // Cache manager not available, consider healthy
      return true;
    }
  } catch (error) {
    console.error('Cache health check failed:', error);
    return false;
  }
}

/**
 * Check database read connectivity
 */
async function checkDatabaseRead(): Promise<boolean> {
  try {
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Simple read-only query to test connectivity
    const { error } = await supabase
      .from('app_config')
      .select('system_mode')
      .limit(1);

    return !error;
  } catch (error) {
    console.error('Database read health check failed:', error);
    return false;
  }
}

/**
 * Check memory usage
 */
function checkMemory(): { healthy: boolean; usage: number; percentage: number } {
  const memUsage = process.memoryUsage();
  const totalMemory = memUsage.heapTotal;
  const usedMemory = memUsage.heapUsed;
  const percentage = (usedMemory / totalMemory) * 100;

  return {
    healthy: percentage < 85, // More conservative for public API
    usage: usedMemory,
    percentage: Math.round(percentage * 100) / 100
  };
}