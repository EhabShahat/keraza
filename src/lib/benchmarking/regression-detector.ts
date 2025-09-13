/**
 * Performance Regression Detection and Alerting System
 * Monitors performance metrics and detects regressions automatically
 */

import { BenchmarkMetrics, BenchmarkComparison } from './performance-benchmarker';

export interface RegressionThreshold {
  metric: keyof BenchmarkMetrics;
  maxDegradation: number; // percentage
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface RegressionAlert {
  id: string;
  timestamp: Date;
  metric: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  currentValue: number;
  baselineValue: number;
  degradation: number; // percentage
  threshold: number;
  message: string;
  resolved: boolean;
  resolvedAt?: Date;
}

export interface RegressionReport {
  timestamp: Date;
  overallStatus: 'healthy' | 'warning' | 'critical';
  alerts: RegressionAlert[];
  summary: {
    totalAlerts: number;
    criticalAlerts: number;
    highAlerts: number;
    mediumAlerts: number;
    lowAlerts: number;
  };
  recommendations: string[];
}

export class RegressionDetector {
  private thresholds: RegressionThreshold[] = [
    { metric: 'responseTime', maxDegradation: 25, severity: 'high' },
    { metric: 'throughput', maxDegradation: 20, severity: 'high' },
    { metric: 'errorRate', maxDegradation: 5, severity: 'critical' },
    { metric: 'memoryUsage', maxDegradation: 30, severity: 'medium' },
    { metric: 'cacheHitRate', maxDegradation: 15, severity: 'medium' },
    { metric: 'databaseQueryTime', maxDegradation: 40, severity: 'high' }
  ];

  private activeAlerts: Map<string, RegressionAlert> = new Map();
  private alertHistory: RegressionAlert[] = [];

  /**
   * Analyze performance comparison and detect regressions
   */
  analyzePerformance(comparison: BenchmarkComparison): RegressionReport {
    console.log('🔍 Analyzing performance for regressions...');

    const alerts: RegressionAlert[] = [];
    const timestamp = new Date();

    // Check each metric against thresholds
    for (const threshold of this.thresholds) {
      const alert = this.checkMetricRegression(comparison, threshold, timestamp);
      if (alert) {
        alerts.push(alert);
        this.activeAlerts.set(alert.id, alert);
        this.alertHistory.push(alert);
      }
    }

    // Check for resolved alerts
    this.checkResolvedAlerts(comparison);

    const summary = this.calculateAlertSummary(alerts);
    const overallStatus = this.determineOverallStatus(summary);
    const recommendations = this.generateRecommendations(alerts, comparison);

    const report: RegressionReport = {
      timestamp,
      overallStatus,
      alerts,
      summary,
      recommendations
    };

    console.log(`📊 Regression analysis complete: ${overallStatus} status with ${alerts.length} new alerts`);

    return report;
  }

  /**
   * Check a specific metric for regression
   */
  private checkMetricRegression(
    comparison: BenchmarkComparison,
    threshold: RegressionThreshold,
    timestamp: Date
  ): RegressionAlert | null {
    const baselineValue = comparison.baseline[threshold.metric] as number;
    const currentValue = comparison.current[threshold.metric] as number;

    // Calculate degradation percentage
    let degradation: number;
    
    if (threshold.metric === 'errorRate') {
      // For error rate, any increase is degradation
      degradation = currentValue - baselineValue;
    } else if (threshold.metric === 'throughput' || threshold.metric === 'cacheHitRate') {
      // For throughput and cache hit rate, decrease is degradation
      degradation = ((baselineValue - currentValue) / baselineValue) * 100;
    } else {
      // For response time, memory usage, etc., increase is degradation
      degradation = ((currentValue - baselineValue) / baselineValue) * 100;
    }

    // Check if degradation exceeds threshold
    if (degradation > threshold.maxDegradation) {
      const alertId = `${threshold.metric}-${timestamp.getTime()}`;
      
      return {
        id: alertId,
        timestamp,
        metric: threshold.metric,
        severity: threshold.severity,
        currentValue,
        baselineValue,
        degradation,
        threshold: threshold.maxDegradation,
        message: this.generateAlertMessage(threshold.metric, degradation, threshold.maxDegradation),
        resolved: false
      };
    }

    return null;
  }

  /**
   * Check for resolved alerts
   */
  private checkResolvedAlerts(comparison: BenchmarkComparison): void {
    for (const [alertId, alert] of this.activeAlerts) {
      if (!alert.resolved) {
        const threshold = this.thresholds.find(t => t.metric === alert.metric);
        if (threshold) {
          const newAlert = this.checkMetricRegression(comparison, threshold, new Date());
          
          // If no new alert for this metric, the issue is resolved
          if (!newAlert) {
            alert.resolved = true;
            alert.resolvedAt = new Date();
            console.log(`✅ Alert resolved: ${alert.metric} performance improved`);
          }
        }
      }
    }
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(metric: string, degradation: number, threshold: number): string {
    const metricNames: { [key: string]: string } = {
      responseTime: 'Response Time',
      throughput: 'Throughput',
      errorRate: 'Error Rate',
      memoryUsage: 'Memory Usage',
      cacheHitRate: 'Cache Hit Rate',
      databaseQueryTime: 'Database Query Time'
    };

    const metricName = metricNames[metric] || metric;
    
    if (metric === 'errorRate') {
      return `${metricName} increased by ${degradation.toFixed(2)}% (threshold: ${threshold}%)`;
    } else if (metric === 'throughput' || metric === 'cacheHitRate') {
      return `${metricName} decreased by ${degradation.toFixed(2)}% (threshold: ${threshold}%)`;
    } else {
      return `${metricName} increased by ${degradation.toFixed(2)}% (threshold: ${threshold}%)`;
    }
  }

  /**
   * Calculate alert summary
   */
  private calculateAlertSummary(alerts: RegressionAlert[]): RegressionReport['summary'] {
    return {
      totalAlerts: alerts.length,
      criticalAlerts: alerts.filter(a => a.severity === 'critical').length,
      highAlerts: alerts.filter(a => a.severity === 'high').length,
      mediumAlerts: alerts.filter(a => a.severity === 'medium').length,
      lowAlerts: alerts.filter(a => a.severity === 'low').length
    };
  }

  /**
   * Determine overall system status
   */
  private determineOverallStatus(summary: RegressionReport['summary']): 'healthy' | 'warning' | 'critical' {
    if (summary.criticalAlerts > 0) {
      return 'critical';
    } else if (summary.highAlerts > 0 || summary.mediumAlerts > 2) {
      return 'warning';
    } else {
      return 'healthy';
    }
  }

  /**
   * Generate recommendations based on alerts
   */
  private generateRecommendations(alerts: RegressionAlert[], comparison: BenchmarkComparison): string[] {
    const recommendations: string[] = [];

    // Response time recommendations
    const responseTimeAlert = alerts.find(a => a.metric === 'responseTime');
    if (responseTimeAlert) {
      recommendations.push('Consider implementing additional caching layers');
      recommendations.push('Review database query performance and optimize slow queries');
      recommendations.push('Check for memory leaks or inefficient algorithms');
    }

    // Throughput recommendations
    const throughputAlert = alerts.find(a => a.metric === 'throughput');
    if (throughputAlert) {
      recommendations.push('Scale up server resources or add load balancing');
      recommendations.push('Optimize API endpoints for better concurrency');
      recommendations.push('Review connection pooling and resource management');
    }

    // Error rate recommendations
    const errorRateAlert = alerts.find(a => a.metric === 'errorRate');
    if (errorRateAlert) {
      recommendations.push('Investigate error logs for root cause analysis');
      recommendations.push('Implement circuit breakers for external dependencies');
      recommendations.push('Review input validation and error handling');
    }

    // Memory usage recommendations
    const memoryAlert = alerts.find(a => a.metric === 'memoryUsage');
    if (memoryAlert) {
      recommendations.push('Profile application for memory leaks');
      recommendations.push('Optimize data structures and caching strategies');
      recommendations.push('Consider garbage collection tuning');
    }

    // Cache hit rate recommendations
    const cacheAlert = alerts.find(a => a.metric === 'cacheHitRate');
    if (cacheAlert) {
      recommendations.push('Review cache invalidation strategies');
      recommendations.push('Optimize cache key patterns and TTL settings');
      recommendations.push('Consider cache warming for frequently accessed data');
    }

    // Database query time recommendations
    const dbAlert = alerts.find(a => a.metric === 'databaseQueryTime');
    if (dbAlert) {
      recommendations.push('Analyze and optimize slow database queries');
      recommendations.push('Review database indexes and query execution plans');
      recommendations.push('Consider database connection pooling optimization');
    }

    // General recommendations based on overall performance
    if (comparison.overallScore < 70) {
      recommendations.push('Consider rolling back recent changes if performance degraded significantly');
      recommendations.push('Run comprehensive load testing to identify bottlenecks');
      recommendations.push('Review system architecture for optimization opportunities');
    }

    return recommendations;
  }

  /**
   * Set custom thresholds
   */
  setThresholds(thresholds: RegressionThreshold[]): void {
    this.thresholds = thresholds;
    console.log(`📊 Updated regression thresholds: ${thresholds.length} metrics configured`);
  }

  /**
   * Get current thresholds
   */
  getThresholds(): RegressionThreshold[] {
    return [...this.thresholds];
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): RegressionAlert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): RegressionAlert[] {
    const history = [...this.alertHistory].sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Clear resolved alerts
   */
  clearResolvedAlerts(): void {
    for (const [alertId, alert] of this.activeAlerts) {
      if (alert.resolved) {
        this.activeAlerts.delete(alertId);
      }
    }
    console.log('🧹 Cleared resolved alerts');
  }

  /**
   * Send alert notifications
   */
  async sendAlertNotifications(alerts: RegressionAlert[]): Promise<void> {
    for (const alert of alerts) {
      if (alert.severity === 'critical' || alert.severity === 'high') {
        await this.sendAlert(alert);
      }
    }
  }

  /**
   * Send individual alert
   */
  private async sendAlert(alert: RegressionAlert): Promise<void> {
    try {
      // Send to monitoring system
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/monitoring/alerts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'performance_regression',
          severity: alert.severity,
          message: alert.message,
          metadata: {
            metric: alert.metric,
            degradation: alert.degradation,
            threshold: alert.threshold,
            currentValue: alert.currentValue,
            baselineValue: alert.baselineValue
          }
        })
      });

      console.log(`🚨 Alert sent: ${alert.message}`);
    } catch (error) {
      console.error('Failed to send alert:', error);
    }
  }

  /**
   * Generate performance trend analysis
   */
  generateTrendAnalysis(historicalData: BenchmarkMetrics[]): {
    trends: { [metric: string]: 'improving' | 'stable' | 'degrading' };
    predictions: { [metric: string]: number };
  } {
    const trends: { [metric: string]: 'improving' | 'stable' | 'degrading' } = {};
    const predictions: { [metric: string]: number } = {};

    if (historicalData.length < 3) {
      return { trends, predictions };
    }

    const metrics: (keyof BenchmarkMetrics)[] = [
      'responseTime', 'throughput', 'errorRate', 'memoryUsage', 'cacheHitRate', 'databaseQueryTime'
    ];

    for (const metric of metrics) {
      const values = historicalData.map(d => d[metric] as number);
      const trend = this.calculateTrend(values);
      trends[metric] = trend;
      
      // Simple linear prediction for next value
      predictions[metric] = this.predictNextValue(values);
    }

    return { trends, predictions };
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(values: number[]): 'improving' | 'stable' | 'degrading' {
    if (values.length < 2) return 'stable';

    const recent = values.slice(-3); // Last 3 values
    const older = values.slice(0, -3); // Earlier values

    if (recent.length === 0 || older.length === 0) return 'stable';

    const recentAvg = recent.reduce((a, b) => a + b, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b, 0) / older.length;

    const change = ((recentAvg - olderAvg) / olderAvg) * 100;

    if (Math.abs(change) < 5) return 'stable';
    return change > 0 ? 'degrading' : 'improving';
  }

  /**
   * Predict next value using simple linear regression
   */
  private predictNextValue(values: number[]): number {
    if (values.length < 2) return values[0] || 0;

    const n = values.length;
    const x = Array.from({ length: n }, (_, i) => i);
    const y = values;

    const sumX = x.reduce((a, b) => a + b, 0);
    const sumY = y.reduce((a, b) => a + b, 0);
    const sumXY = x.reduce((sum, xi, i) => sum + xi * y[i], 0);
    const sumXX = x.reduce((sum, xi) => sum + xi * xi, 0);

    const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
    const intercept = (sumY - slope * sumX) / n;

    return slope * n + intercept;
  }
}

export const regressionDetector = new RegressionDetector();