/**
 * Database Performance Monitor
 * Tracks query performance, connection health, and provides optimization recommendations
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { queryOptimizer } from './query-optimizer';

interface PerformanceAlert {
  id: string;
  type: 'slow_query' | 'high_error_rate' | 'connection_pool_full' | 'memory_usage';
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  metadata?: any;
}

interface DatabaseHealth {
  status: 'healthy' | 'degraded' | 'critical';
  connectionPool: {
    active: number;
    max: number;
    utilization: number;
  };
  queryPerformance: {
    averageResponseTime: number;
    slowQueries: number;
    errorRate: number;
  };
  recommendations: string[];
  alerts: PerformanceAlert[];
}

class DatabasePerformanceMonitor {
  private static instance: DatabasePerformanceMonitor;
  private alerts: PerformanceAlert[] = [];
  private alertCallbacks: ((alert: PerformanceAlert) => void)[] = [];
  private monitoringInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.startMonitoring();
  }

  static getInstance(): DatabasePerformanceMonitor {
    if (!DatabasePerformanceMonitor.instance) {
      DatabasePerformanceMonitor.instance = new DatabasePerformanceMonitor();
    }
    return DatabasePerformanceMonitor.instance;
  }

  /**
   * Start continuous monitoring
   */
  private startMonitoring(): void {
    if (this.monitoringInterval) return;

    this.monitoringInterval = setInterval(() => {
      this.checkPerformance();
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }
  }

  /**
   * Check overall database performance
   */
  private async checkPerformance(): Promise<void> {
    try {
      const analytics = queryOptimizer.getQueryAnalytics(5 * 60 * 1000); // Last 5 minutes
      const poolStatus = queryOptimizer.getPoolStatus();

      // Check for slow queries
      if (analytics.slowQueries.length > 0) {
        this.createAlert({
          type: 'slow_query',
          severity: analytics.slowQueries.length > 5 ? 'high' : 'medium',
          message: `${analytics.slowQueries.length} slow queries detected in the last 5 minutes`,
          metadata: { slowQueries: analytics.slowQueries.slice(0, 3) }
        });
      }

      // Check error rate
      if (analytics.errorRate > 0.1) { // 10% error rate
        this.createAlert({
          type: 'high_error_rate',
          severity: analytics.errorRate > 0.2 ? 'critical' : 'high',
          message: `High error rate detected: ${(analytics.errorRate * 100).toFixed(1)}%`,
          metadata: { errorRate: analytics.errorRate }
        });
      }

      // Check connection pool utilization
      if (poolStatus.poolUtilization > 0.8) { // 80% utilization
        this.createAlert({
          type: 'connection_pool_full',
          severity: poolStatus.poolUtilization > 0.95 ? 'critical' : 'high',
          message: `Connection pool utilization high: ${(poolStatus.poolUtilization * 100).toFixed(1)}%`,
          metadata: { poolStatus }
        });
      }

    } catch (error) {
      console.error('Performance monitoring error:', error);
    }
  }

  /**
   * Create and dispatch alert
   */
  private createAlert(alertData: Omit<PerformanceAlert, 'id' | 'timestamp'>): void {
    const alert: PerformanceAlert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      timestamp: new Date(),
      ...alertData
    };

    this.alerts.push(alert);
    
    // Keep only last 100 alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Notify callbacks
    this.alertCallbacks.forEach(callback => {
      try {
        callback(alert);
      } catch (error) {
        console.error('Alert callback error:', error);
      }
    });

    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error('CRITICAL DATABASE ALERT:', alert);
    }
  }

  /**
   * Get current database health status
   */
  async getDatabaseHealth(): Promise<DatabaseHealth> {
    const analytics = queryOptimizer.getQueryAnalytics(10 * 60 * 1000); // Last 10 minutes
    const poolStatus = queryOptimizer.getPoolStatus();
    
    // Determine overall status
    let status: DatabaseHealth['status'] = 'healthy';
    const recentCriticalAlerts = this.alerts.filter(
      alert => alert.severity === 'critical' && 
      Date.now() - alert.timestamp.getTime() < 5 * 60 * 1000
    );
    
    if (recentCriticalAlerts.length > 0) {
      status = 'critical';
    } else if (analytics.errorRate > 0.05 || poolStatus.poolUtilization > 0.8) {
      status = 'degraded';
    }

    // Generate recommendations
    const recommendations = this.generateRecommendations(analytics, poolStatus);

    return {
      status,
      connectionPool: {
        active: poolStatus.activeConnections,
        max: poolStatus.maxConnections,
        utilization: poolStatus.poolUtilization
      },
      queryPerformance: {
        averageResponseTime: analytics.averageResponseTime,
        slowQueries: analytics.slowQueries.length,
        errorRate: analytics.errorRate
      },
      recommendations,
      alerts: this.alerts.slice(-10) // Last 10 alerts
    };
  }

  /**
   * Generate optimization recommendations
   */
  private generateRecommendations(analytics: any, poolStatus: any): string[] {
    const recommendations: string[] = [];

    if (analytics.averageResponseTime > 500) {
      recommendations.push('Consider adding database indexes for frequently queried columns');
    }

    if (analytics.slowQueries.length > 0) {
      recommendations.push('Review and optimize slow queries identified in the monitoring');
    }

    if (poolStatus.poolUtilization > 0.7) {
      recommendations.push('Consider increasing the connection pool size');
    }

    if (analytics.errorRate > 0.02) {
      recommendations.push('Investigate and fix queries causing errors');
    }

    if (analytics.topQueries.some((q: any) => q.avgDuration > 1000)) {
      recommendations.push('Optimize frequently used queries with high response times');
    }

    return recommendations;
  }

  /**
   * Run database diagnostics
   */
  async runDiagnostics(client?: SupabaseClient): Promise<{
    tableStats: any[];
    indexUsage: any[];
    slowQueries: any[];
    recommendations: string[];
  }> {
    const supabase = client || queryOptimizer.getOptimizedClient();
    
    try {
      // Get table statistics
      const tableStatsQuery = `
        SELECT 
          schemaname,
          tablename,
          n_tup_ins as inserts,
          n_tup_upd as updates,
          n_tup_del as deletes,
          n_live_tup as live_tuples,
          n_dead_tup as dead_tuples
        FROM pg_stat_user_tables 
        WHERE schemaname = 'public'
        ORDER BY n_live_tup DESC;
      `;

      const { data: tableStats } = await supabase.rpc('exec_sql', { 
        sql: `SELECT * FROM (${tableStatsQuery}) as stats` 
      });

      // Get index usage statistics
      const indexUsageQuery = `
        SELECT 
          schemaname,
          tablename,
          indexname,
          idx_tup_read,
          idx_tup_fetch
        FROM pg_stat_user_indexes 
        WHERE schemaname = 'public'
        ORDER BY idx_tup_read DESC;
      `;

      const { data: indexUsage } = await supabase.rpc('exec_sql', { 
        sql: `SELECT * FROM (${indexUsageQuery}) as idx_stats` 
      });

      const analytics = queryOptimizer.getQueryAnalytics();
      
      return {
        tableStats: tableStats || [],
        indexUsage: indexUsage || [],
        slowQueries: analytics.slowQueries,
        recommendations: this.generateRecommendations(analytics, queryOptimizer.getPoolStatus())
      };

    } catch (error) {
      console.error('Diagnostics error:', error);
      return {
        tableStats: [],
        indexUsage: [],
        slowQueries: [],
        recommendations: ['Unable to run full diagnostics - check database permissions']
      };
    }
  }

  /**
   * Subscribe to performance alerts
   */
  onAlert(callback: (alert: PerformanceAlert) => void): () => void {
    this.alertCallbacks.push(callback);
    
    // Return unsubscribe function
    return () => {
      const index = this.alertCallbacks.indexOf(callback);
      if (index > -1) {
        this.alertCallbacks.splice(index, 1);
      }
    };
  }

  /**
   * Get performance metrics for dashboard
   */
  getPerformanceMetrics(timeWindow?: number): {
    queryCount: number;
    averageResponseTime: number;
    errorRate: number;
    slowQueryCount: number;
    connectionPoolUtilization: number;
    topQueries: Array<{ query: string; count: number; avgDuration: number }>;
  } {
    const analytics = queryOptimizer.getQueryAnalytics(timeWindow);
    const poolStatus = queryOptimizer.getPoolStatus();

    return {
      queryCount: analytics.totalQueries,
      averageResponseTime: analytics.averageResponseTime,
      errorRate: analytics.errorRate,
      slowQueryCount: analytics.slowQueries.length,
      connectionPoolUtilization: poolStatus.poolUtilization,
      topQueries: analytics.topQueries
    };
  }

  /**
   * Clear old alerts
   */
  clearOldAlerts(olderThanHours: number = 24): void {
    const cutoff = new Date(Date.now() - olderThanHours * 60 * 60 * 1000);
    this.alerts = this.alerts.filter(alert => alert.timestamp > cutoff);
  }
}

export const performanceMonitor = DatabasePerformanceMonitor.getInstance();
export type { PerformanceAlert, DatabaseHealth };