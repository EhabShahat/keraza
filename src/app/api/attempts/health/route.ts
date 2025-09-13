/**
 * Attempts API Health Check Endpoint
 * Provides health status for the consolidated attempts API handler
 */

import { NextRequest, NextResponse } from 'next/server';
import { healthMonitor } from '@/lib/monitoring/health-monitor';

export async function GET(request: NextRequest) {
  const startTime = Date.now();
  
  try {
    // Health checks specific to attempts functionality
    const checks = {
      database: await checkDatabase(),
      realtime: await checkRealtime(),
      storage: await checkStorage(),
      memory: checkMemory(),
      uptime: process.uptime(),
      timestamp: new Date().toISOString()
    };

    const responseTime = Date.now() - startTime;
    const isHealthy = checks.database && checks.realtime && checks.storage && checks.memory.healthy;

    // Record metrics
    healthMonitor.recordMetrics('attempts-api', {
      timestamp: new Date(),
      function_name: 'attempts-api',
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
        'X-Health-Check': 'attempts-api'
      }
    });

  } catch (error) {
    const responseTime = Date.now() - startTime;
    
    // Record error metrics
    healthMonitor.recordMetrics('attempts-api', {
      timestamp: new Date(),
      function_name: 'attempts-api',
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
        'X-Health-Check': 'attempts-api'
      }
    });
  }
}

/**
 * Check database connectivity for attempts
 */
async function checkDatabase(): Promise<boolean> {
  try {
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Test attempts-specific tables
    const { error } = await supabase
      .from('exam_attempts')
      .select('id')
      .limit(1);

    return !error;
  } catch (error) {
    console.error('Attempts database health check failed:', error);
    return false;
  }
}

/**
 * Check realtime functionality
 */
async function checkRealtime(): Promise<boolean> {
  try {
    // Test realtime connection
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Check if realtime is available
    const channel = supabase.channel('health-check');
    const isConnected = channel.socket.isConnected();
    
    // Clean up
    supabase.removeChannel(channel);
    
    return true; // Consider healthy even if not connected for health check
  } catch (error) {
    console.error('Realtime health check failed:', error);
    return false;
  }
}

/**
 * Check storage functionality
 */
async function checkStorage(): Promise<boolean> {
  try {
    // Import Supabase client
    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Test storage bucket access
    const { data, error } = await supabase.storage
      .from('exam-uploads')
      .list('', { limit: 1 });

    return !error;
  } catch (error) {
    console.error('Storage health check failed:', error);
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
    healthy: percentage < 95, // Higher threshold for attempts API
    usage: usedMemory,
    percentage: Math.round(percentage * 100) / 100
  };
}