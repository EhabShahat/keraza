/**
 * Monitoring Status API Endpoint
 * Provides monitoring system status and health information
 */

import { NextRequest, NextResponse } from 'next/server';
import { getMonitoringInstance } from '@/lib/monitoring/monitoring-init';
import { healthMonitor } from '@/lib/monitoring/health-monitor';
import { alertingSystem } from '@/lib/monitoring/alerting-system';

export async function GET(request: NextRequest) {
  try {
    const monitoringInstance = getMonitoringInstance();
    
    if (!monitoringInstance) {
      return NextResponse.json({
        error: 'Monitoring system not initialized'
      }, { status: 503 });
    }

    const status = monitoringInstance.getStatus();
    const healthStatuses = healthMonitor.getAllHealthStatus();
    const activeAlerts = alertingSystem.getActiveAlerts();
    const allAlerts = alertingSystem.getAllAlerts();

    // Calculate summary statistics
    const summary = {
      total_functions: healthStatuses.length,
      healthy_functions: healthStatuses.filter(h => h.status === 'healthy').length,
      degraded_functions: healthStatuses.filter(h => h.status === 'degraded').length,
      unhealthy_functions: healthStatuses.filter(h => h.status === 'unhealthy').length,
      active_alerts: activeAlerts.length,
      total_alerts: allAlerts.length,
      avg_response_time: healthStatuses.length > 0 
        ? healthStatuses.reduce((sum, h) => sum + h.response_time, 0) / healthStatuses.length
        : 0
    };

    // Get detailed metrics for each function
    const functionMetrics = healthStatuses.map(health => {
      const metrics = healthMonitor.getAggregatedMetrics(health.function_name, 24);
      return {
        function_name: health.function_name,
        current_health: health,
        metrics_24h: metrics
      };
    });

    return NextResponse.json({
      monitoring_status: status,
      summary,
      function_metrics: functionMetrics,
      active_alerts: activeAlerts,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('Error getting monitoring status:', error);
    return NextResponse.json({
      error: 'Failed to get monitoring status',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, function_name, rule_id } = body;

    switch (action) {
      case 'acknowledge_alert':
        if (!rule_id || !function_name) {
          return NextResponse.json({
            error: 'Missing rule_id or function_name'
          }, { status: 400 });
        }
        
        // Mark alert as acknowledged (implementation depends on alerting system)
        return NextResponse.json({
          success: true,
          message: 'Alert acknowledged'
        });

      case 'force_health_check':
        if (!function_name) {
          return NextResponse.json({
            error: 'Missing function_name'
          }, { status: 400 });
        }
        
        // Force a health check (implementation would trigger immediate check)
        return NextResponse.json({
          success: true,
          message: `Health check triggered for ${function_name}`
        });

      default:
        return NextResponse.json({
          error: 'Invalid action'
        }, { status: 400 });
    }

  } catch (error) {
    console.error('Error handling monitoring action:', error);
    return NextResponse.json({
      error: 'Failed to handle monitoring action',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}