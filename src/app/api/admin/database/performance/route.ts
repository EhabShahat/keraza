/**
 * Database Performance Monitoring API
 * Provides performance metrics, health status, and optimization recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceMonitor } from '@/lib/database/performance-monitor';
import { queryOptimizer } from '@/lib/database/query-optimizer';
import { getBearerToken } from '@/lib/admin';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    
    // Verify admin access
    const { data: user } = await svc.auth.getUser(token || '');
    if (!user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');
    const timeWindow = parseInt(url.searchParams.get('timeWindow') || '600000'); // Default 10 minutes

    switch (action) {
      case 'health':
        const health = await performanceMonitor.getDatabaseHealth();
        return NextResponse.json({ health });

      case 'metrics':
        const metrics = performanceMonitor.getPerformanceMetrics(timeWindow);
        return NextResponse.json({ metrics });

      case 'analytics':
        const analytics = queryOptimizer.getQueryAnalytics(timeWindow);
        return NextResponse.json({ analytics });

      case 'diagnostics':
        const diagnostics = await performanceMonitor.runDiagnostics(svc);
        return NextResponse.json({ diagnostics });

      case 'pool-status':
        const poolStatus = queryOptimizer.getPoolStatus();
        return NextResponse.json({ poolStatus });

      default:
        // Return comprehensive performance overview
        const [healthData, metricsData, analyticsData, poolData] = await Promise.all([
          performanceMonitor.getDatabaseHealth(),
          Promise.resolve(performanceMonitor.getPerformanceMetrics(timeWindow)),
          Promise.resolve(queryOptimizer.getQueryAnalytics(timeWindow)),
          Promise.resolve(queryOptimizer.getPoolStatus())
        ]);

        return NextResponse.json({
          health: healthData,
          metrics: metricsData,
          analytics: analyticsData,
          poolStatus: poolData,
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('Database performance API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch performance data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    
    // Verify admin access
    const { data: user } = await svc.auth.getUser(token || '');
    if (!user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'clear-pool':
        queryOptimizer.clearPool();
        return NextResponse.json({ success: true, message: 'Connection pool cleared' });

      case 'clear-alerts':
        const hours = body.hours || 24;
        performanceMonitor.clearOldAlerts(hours);
        return NextResponse.json({ success: true, message: `Alerts older than ${hours} hours cleared` });

      case 'run-diagnostics':
        const diagnostics = await performanceMonitor.runDiagnostics(svc);
        return NextResponse.json({ diagnostics });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Database performance action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute action' },
      { status: 500 }
    );
  }
}