/**
 * Admin API Health Check Endpoint
 * Provides health status for the consolidated admin API handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { healthMonitor } from '@/lib/monitoring/health-monitor';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Basic health checks
    const checks = {
      database: await checkDatabase(),
      memory: checkMemory(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    const responseTime = Date.now() - startTime;
    const isHealthy = checks.database && checks.memory.healthy;

    // Record metrics
    healthMonitor.recordMetrics('admin-api', {
      timestamp: new Date(),
      function_name: 'admin-api',
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
        'X-Health-Check': 'admin-api'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Record error metrics
    healthMonitor.recordMetrics('admin-api', {
      timestamp: new Date(),
      function_name: 'admin-api',
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
        'X-Health-Check': 'admin-api'
      }
    });
  }
}

/**
 * Check database connectivity
 */
async function checkDatabase(): Promise<boolean> {
  try {
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Simple query to test connectivity
    const { error } = await supabase
      .from('app_config')
      .select('id')
      .limit(1);

    return !error;
  } catch (error) {
    console.error('Database health check failed:', error);
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
    healthy: percentage < 90, // Consider unhealthy if using >90% of heap
    usage: usedMemory,
    percentage: Math.round(percentage * 100) / 100
  };
}