/**
 * Safety Monitoring System
 * 
 * Monitors deployment safety metrics and triggers automatic
 * rollbacks when safety thresholds are breached.
 */

import { rollbackSystem, SafetyMetrics } from './rollback-system';

export interface SafetyThreshold {
  id: string;
  name: string;
  metric: 'error_rate' | 'response_time' | 'availability' | 'throughput' | 'memory_usage' | 'cpu_usage';
  warning_threshold: number;
  critical_threshold: number;
  duration: number; // seconds to observe before alerting
  enabled: boolean;
  actions: SafetyAction[];
}

export interface SafetyAction {
  type: 'alert' | 'rollback' | 'scale' | 'throttle' | 'circuit_breaker';
  trigger_level: 'warning' | 'critical';
  parameters: Record<string, any>;
  delay: number; // seconds to wait before executing
}

export interface SafetyAlert {
  id: string;
  threshold_id: string;
  level: 'warning' | 'critical';
  metric: string;
  current_value: number;
  threshold_value: number;
  timestamp: Date;
  resolved: boolean;
  resolved_at?: Date;
  actions_taken: string[];
}

export interface SafetyReport {
  timestamp: Date;
  overall_status: 'safe' | 'warning' | 'critical';
  active_alerts: SafetyAlert[];
  metrics_summary: MetricsSummary;
  recommendations: SafetyRecommendation[];
}

export interface MetricsSummary {
  error_rate: {
    current: number;
    trend: 'improving' | 'stable' | 'degrading';
    threshold_status: 'safe' | 'warning' | 'critical';
  };
  response_time: {
    current: number;
    trend: 'improving' | 'stable' | 'degrading';
    threshold_status: 'safe' | 'warning' | 'critical';
  };
  availability: {
    current: number;
    trend: 'improving' | 'stable' | 'degrading';
    threshold_status: 'safe' | 'warning' | 'critical';
  };
  throughput: {
    current: number;
    trend: 'improving' | 'stable' | 'degrading';
    threshold_status: 'safe' | 'warning' | 'critical';
  };
}

export interface SafetyRecommendation {
  type: 'performance' | 'reliability' | 'capacity' | 'security';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  title: string;
  description: string;
  action_items: string[];
  estimated_impact: string;
}

export class SafetyMonitor {
  private thresholds: Map<string, SafetyThreshold> = new Map();
  private alerts: SafetyAlert[] = [];
  private metricsHistory: SafetyMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;
  private alertingEnabled: boolean = true;

  constructor() {
    this.initializeDefaultThresholds();
  }

  /**
   * Initialize default safety thresholds
   */
  private initializeDefaultThresholds(): void {
    const defaultThresholds: SafetyThreshold[] = [
      {
        id: 'error-rate-threshold',
        name: 'Error Rate Monitoring',
        metric: 'error_rate',
        warning_threshold: 0.02, // 2%
        critical_threshold: 0.05, // 5%
        duration: 120, // 2 minutes
        enabled: true,
        actions: [
          {
            type: 'alert',
            trigger_level: 'warning',
            parameters: { severity: 'medium' },
            delay: 0
          },
          {
            type: 'rollback',
            trigger_level: 'critical',
            parameters: { immediate: true },
            delay: 60 // Wait 1 minute before rollback
          }
        ]
      },
      {
        id: 'response-time-threshold',
        name: 'Response Time Monitoring',
        metric: 'response_time',
        warning_threshold: 1000, // 1 second
        critical_threshold: 2000, // 2 seconds
        duration: 180, // 3 minutes
        enabled: true,
        actions: [
          {
            type: 'alert',
            trigger_level: 'warning',
            parameters: { severity: 'medium' },
            delay: 0
          },
          {
            type: 'scale',
            trigger_level: 'critical',
            parameters: { scale_factor: 1.5 },
            delay: 120 // Wait 2 minutes before scaling
          }
        ]
      },
      {
        id: 'availability-threshold',
        name: 'Availability Monitoring',
        metric: 'availability',
        warning_threshold: 0.99, // 99%
        critical_threshold: 0.95, // 95%
        duration: 300, // 5 minutes
        enabled: true,
        actions: [
          {
            type: 'alert',
            trigger_level: 'warning',
            parameters: { severity: 'high' },
            delay: 0
          },
          {
            type: 'rollback',
            trigger_level: 'critical',
            parameters: { immediate: true },
            delay: 0 // Immediate rollback for availability issues
          }
        ]
      },
      {
        id: 'throughput-threshold',
        name: 'Throughput Monitoring',
        metric: 'throughput',
        warning_threshold: 0.8, // 80% of baseline
        critical_threshold: 0.5, // 50% of baseline
        duration: 240, // 4 minutes
        enabled: true,
        actions: [
          {
            type: 'alert',
            trigger_level: 'warning',
            parameters: { severity: 'medium' },
            delay: 0
          },
          {
            type: 'circuit_breaker',
            trigger_level: 'critical',
            parameters: { timeout: 300 },
            delay: 180 // Wait 3 minutes before circuit breaker
          }
        ]
      }
    ];

    defaultThresholds.forEach(threshold => {
      this.thresholds.set(threshold.id, threshold);
    });
  }

  /**
   * Start safety monitoring
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log('Starting safety monitoring');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.performSafetyCheck();
      } catch (error) {
        console.error('Error performing safety check:', error);
      }
    }, 30000); // Check every 30 seconds

    // Perform initial check
    this.performSafetyCheck().catch(error => {
      console.error('Initial safety check failed:', error);
    });
  }

  /**
   * Stop safety monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('Stopped safety monitoring');
    }
  }

  /**
   * Perform comprehensive safety check
   */
  private async performSafetyCheck(): Promise<void> {
    // Collect current metrics
    const currentMetrics = await this.collectMetrics();
    this.recordMetrics(currentMetrics);

    // Check all enabled thresholds
    const enabledThresholds = Array.from(this.thresholds.values()).filter(t => t.enabled);
    
    for (const threshold of enabledThresholds) {
      await this.checkThreshold(threshold, currentMetrics);
    }

    // Resolve alerts that are no longer active
    await this.resolveInactiveAlerts();

    // Generate safety report
    const report = this.generateSafetyReport();
    
    // Log critical issues
    if (report.overall_status === 'critical') {
      console.error('CRITICAL: Safety monitoring detected critical issues', {
        active_alerts: report.active_alerts.length,
        critical_alerts: report.active_alerts.filter(a => a.level === 'critical').length
      });
    }
  }

  /**
   * Check individual safety threshold
   */
  private async checkThreshold(threshold: SafetyThreshold, currentMetrics: SafetyMetrics): Promise<void> {
    const metricValue = this.extractMetricValue(currentMetrics, threshold.metric);
    
    // Get historical data for the duration period
    const durationMs = threshold.duration * 1000;
    const cutoffTime = new Date(Date.now() - durationMs);
    const historicalMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);
    
    if (historicalMetrics.length === 0) {
      return; // Not enough data
    }

    // Calculate average over the duration
    const historicalValues = historicalMetrics.map(m => this.extractMetricValue(m, threshold.metric));
    const averageValue = historicalValues.reduce((sum, val) => sum + val, 0) / historicalValues.length;

    // Check thresholds
    let alertLevel: 'warning' | 'critical' | null = null;
    let thresholdValue: number;

    if (this.isThresholdBreached(averageValue, threshold.critical_threshold, threshold.metric)) {
      alertLevel = 'critical';
      thresholdValue = threshold.critical_threshold;
    } else if (this.isThresholdBreached(averageValue, threshold.warning_threshold, threshold.metric)) {
      alertLevel = 'warning';
      thresholdValue = threshold.warning_threshold;
    }

    if (alertLevel) {
      // Check if alert already exists
      const existingAlert = this.alerts.find(a => 
        a.threshold_id === threshold.id && 
        a.level === alertLevel && 
        !a.resolved
      );

      if (!existingAlert) {
        // Create new alert
        const alert = await this.createAlert(threshold, alertLevel, averageValue, thresholdValue);
        
        // Execute actions
        await this.executeThresholdActions(threshold, alertLevel, alert);
      }
    }
  }

  /**
   * Extract metric value from SafetyMetrics
   */
  private extractMetricValue(metrics: SafetyMetrics, metricType: string): number {
    switch (metricType) {
      case 'error_rate':
        return metrics.error_rate;
      case 'response_time':
        return metrics.avg_response_time;
      case 'availability':
        // Calculate availability based on health check failures
        return Math.max(0, 1 - (metrics.health_check_failures / 10)); // Assume max 10 checks
      case 'throughput':
        return metrics.traffic_volume;
      case 'memory_usage':
        return 0.7; // Simulated memory usage
      case 'cpu_usage':
        return 0.6; // Simulated CPU usage
      default:
        return 0;
    }
  }

  /**
   * Check if threshold is breached based on metric type
   */
  private isThresholdBreached(value: number, threshold: number, metricType: string): boolean {
    switch (metricType) {
      case 'error_rate':
      case 'response_time':
      case 'memory_usage':
      case 'cpu_usage':
        return value > threshold; // Higher is worse
      case 'availability':
      case 'throughput':
        return value < threshold; // Lower is worse
      default:
        return false;
    }
  }

  /**
   * Create safety alert
   */
  private async createAlert(
    threshold: SafetyThreshold,
    level: 'warning' | 'critical',
    currentValue: number,
    thresholdValue: number
  ): Promise<SafetyAlert> {
    const alert: SafetyAlert = {
      id: this.generateAlertId(),
      threshold_id: threshold.id,
      level,
      metric: threshold.metric,
      current_value: currentValue,
      threshold_value: thresholdValue,
      timestamp: new Date(),
      resolved: false,
      actions_taken: []
    };

    this.alerts.push(alert);

    console.log(`Safety alert created: ${threshold.name} - ${level.toUpperCase()}`, {
      metric: threshold.metric,
      current: currentValue,
      threshold: thresholdValue
    });

    return alert;
  }

  /**
   * Execute threshold actions
   */
  private async executeThresholdActions(
    threshold: SafetyThreshold,
    level: 'warning' | 'critical',
    alert: SafetyAlert
  ): Promise<void> {
    const relevantActions = threshold.actions.filter(action => action.trigger_level === level);

    for (const action of relevantActions) {
      try {
        if (action.delay > 0) {
          console.log(`Delaying action ${action.type} for ${action.delay} seconds`);
          setTimeout(async () => {
            await this.executeAction(action, alert);
          }, action.delay * 1000);
        } else {
          await this.executeAction(action, alert);
        }
      } catch (error) {
        console.error(`Failed to execute action ${action.type}:`, error);
      }
    }
  }

  /**
   * Execute safety action
   */
  private async executeAction(action: SafetyAction, alert: SafetyAlert): Promise<void> {
    console.log(`Executing safety action: ${action.type} for alert ${alert.id}`);

    switch (action.type) {
      case 'alert':
        await this.sendAlert(action, alert);
        break;
      case 'rollback':
        await this.triggerRollback(action, alert);
        break;
      case 'scale':
        await this.triggerScaling(action, alert);
        break;
      case 'throttle':
        await this.enableThrottling(action, alert);
        break;
      case 'circuit_breaker':
        await this.enableCircuitBreaker(action, alert);
        break;
      default:
        console.warn(`Unknown action type: ${action.type}`);
    }

    alert.actions_taken.push(`${action.type}:${new Date().toISOString()}`);
  }

  /**
   * Send safety alert
   */
  private async sendAlert(action: SafetyAction, alert: SafetyAlert): Promise<void> {
    const { severity } = action.parameters;
    
    console.log(`Sending ${severity} alert for ${alert.metric} threshold breach`);
    
    // This would integrate with notification systems
    await this.sleep(100);
  }

  /**
   * Trigger automatic rollback
   */
  private async triggerRollback(action: SafetyAction, alert: SafetyAlert): Promise<void> {
    const { immediate } = action.parameters;
    
    console.log(`Triggering ${immediate ? 'immediate' : 'standard'} rollback due to safety alert`);
    
    try {
      const reason = `Safety threshold breached: ${alert.metric} = ${alert.current_value} (threshold: ${alert.threshold_value})`;
      await rollbackSystem.manualRollback(reason, 'safety-monitor');
      
      console.log('Rollback triggered successfully by safety monitor');
    } catch (error) {
      console.error('Failed to trigger rollback:', error);
    }
  }

  /**
   * Trigger scaling action
   */
  private async triggerScaling(action: SafetyAction, alert: SafetyAlert): Promise<void> {
    const { scale_factor } = action.parameters;
    
    console.log(`Triggering scaling with factor ${scale_factor} due to ${alert.metric} threshold breach`);
    
    // This would integrate with scaling systems
    await this.sleep(1000);
  }

  /**
   * Enable traffic throttling
   */
  private async enableThrottling(action: SafetyAction, alert: SafetyAlert): Promise<void> {
    const { rate_limit } = action.parameters;
    
    console.log(`Enabling traffic throttling (rate: ${rate_limit}) due to ${alert.metric} threshold breach`);
    
    // This would integrate with rate limiting systems
    await this.sleep(500);
  }

  /**
   * Enable circuit breaker
   */
  private async enableCircuitBreaker(action: SafetyAction, alert: SafetyAlert): Promise<void> {
    const { timeout } = action.parameters;
    
    console.log(`Enabling circuit breaker (timeout: ${timeout}s) due to ${alert.metric} threshold breach`);
    
    // This would integrate with circuit breaker systems
    await this.sleep(500);
  }

  /**
   * Resolve alerts that are no longer active
   */
  private async resolveInactiveAlerts(): Promise<void> {
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    
    for (const alert of activeAlerts) {
      const threshold = this.thresholds.get(alert.threshold_id);
      if (!threshold) continue;

      // Get recent metrics
      const recentMetrics = this.metricsHistory.slice(-5); // Last 5 measurements
      if (recentMetrics.length === 0) continue;

      const recentValues = recentMetrics.map(m => this.extractMetricValue(m, alert.metric));
      const averageValue = recentValues.reduce((sum, val) => sum + val, 0) / recentValues.length;

      // Check if alert condition is no longer met
      const stillBreached = this.isThresholdBreached(averageValue, alert.threshold_value, alert.metric);
      
      if (!stillBreached) {
        alert.resolved = true;
        alert.resolved_at = new Date();
        
        console.log(`Safety alert resolved: ${alert.id} - ${alert.metric} back to normal`);
      }
    }
  }

  /**
   * Collect current system metrics
   */
  private async collectMetrics(): Promise<SafetyMetrics> {
    // This would collect real metrics from various sources
    // For now, we'll simulate realistic metrics
    return {
      error_rate: Math.random() * 0.08, // 0-8%
      avg_response_time: 150 + Math.random() * 300, // 150-450ms
      health_check_failures: Math.floor(Math.random() * 4), // 0-3 failures
      traffic_volume: 800 + Math.random() * 400, // 800-1200 requests
      active_connections: 40 + Math.random() * 80, // 40-120 connections
      timestamp: new Date()
    };
  }

  /**
   * Record metrics in history
   */
  private recordMetrics(metrics: SafetyMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Keep only last 2 hours of metrics (assuming 30-second intervals)
    const maxEntries = 2 * 60 * 2; // 240 entries
    if (this.metricsHistory.length > maxEntries) {
      this.metricsHistory.splice(0, this.metricsHistory.length - maxEntries);
    }
  }

  /**
   * Generate comprehensive safety report
   */
  generateSafetyReport(): SafetyReport {
    const activeAlerts = this.alerts.filter(a => !a.resolved);
    const criticalAlerts = activeAlerts.filter(a => a.level === 'critical');
    const warningAlerts = activeAlerts.filter(a => a.level === 'warning');

    // Determine overall status
    let overallStatus: 'safe' | 'warning' | 'critical';
    if (criticalAlerts.length > 0) {
      overallStatus = 'critical';
    } else if (warningAlerts.length > 0) {
      overallStatus = 'warning';
    } else {
      overallStatus = 'safe';
    }

    // Generate metrics summary
    const metricsSummary = this.generateMetricsSummary();

    // Generate recommendations
    const recommendations = this.generateRecommendations(activeAlerts, metricsSummary);

    return {
      timestamp: new Date(),
      overall_status: overallStatus,
      active_alerts: activeAlerts,
      metrics_summary: metricsSummary,
      recommendations
    };
  }

  /**
   * Generate metrics summary with trends
   */
  private generateMetricsSummary(): MetricsSummary {
    const recentMetrics = this.metricsHistory.slice(-10); // Last 10 measurements
    
    if (recentMetrics.length < 2) {
      // Not enough data for trends
      return {
        error_rate: { current: 0, trend: 'stable', threshold_status: 'safe' },
        response_time: { current: 0, trend: 'stable', threshold_status: 'safe' },
        availability: { current: 1, trend: 'stable', threshold_status: 'safe' },
        throughput: { current: 0, trend: 'stable', threshold_status: 'safe' }
      };
    }

    const latest = recentMetrics[recentMetrics.length - 1];
    const previous = recentMetrics[recentMetrics.length - 2];

    return {
      error_rate: {
        current: latest.error_rate,
        trend: this.calculateTrend(latest.error_rate, previous.error_rate, 'lower_better'),
        threshold_status: this.getThresholdStatus('error_rate', latest.error_rate)
      },
      response_time: {
        current: latest.avg_response_time,
        trend: this.calculateTrend(latest.avg_response_time, previous.avg_response_time, 'lower_better'),
        threshold_status: this.getThresholdStatus('response_time', latest.avg_response_time)
      },
      availability: {
        current: Math.max(0, 1 - (latest.health_check_failures / 10)),
        trend: this.calculateTrend(latest.health_check_failures, previous.health_check_failures, 'lower_better'),
        threshold_status: this.getThresholdStatus('availability', Math.max(0, 1 - (latest.health_check_failures / 10)))
      },
      throughput: {
        current: latest.traffic_volume,
        trend: this.calculateTrend(latest.traffic_volume, previous.traffic_volume, 'higher_better'),
        threshold_status: this.getThresholdStatus('throughput', latest.traffic_volume)
      }
    };
  }

  /**
   * Calculate trend direction
   */
  private calculateTrend(current: number, previous: number, direction: 'higher_better' | 'lower_better'): 'improving' | 'stable' | 'degrading' {
    const change = (current - previous) / previous;
    const threshold = 0.05; // 5% change threshold

    if (Math.abs(change) < threshold) {
      return 'stable';
    }

    if (direction === 'higher_better') {
      return change > 0 ? 'improving' : 'degrading';
    } else {
      return change < 0 ? 'improving' : 'degrading';
    }
  }

  /**
   * Get threshold status for metric
   */
  private getThresholdStatus(metricType: string, value: number): 'safe' | 'warning' | 'critical' {
    const threshold = Array.from(this.thresholds.values()).find(t => t.metric === metricType);
    if (!threshold) return 'safe';

    if (this.isThresholdBreached(value, threshold.critical_threshold, metricType)) {
      return 'critical';
    } else if (this.isThresholdBreached(value, threshold.warning_threshold, metricType)) {
      return 'warning';
    } else {
      return 'safe';
    }
  }

  /**
   * Generate safety recommendations
   */
  private generateRecommendations(alerts: SafetyAlert[], metrics: MetricsSummary): SafetyRecommendation[] {
    const recommendations: SafetyRecommendation[] = [];

    // Error rate recommendations
    if (metrics.error_rate.threshold_status !== 'safe') {
      recommendations.push({
        type: 'reliability',
        priority: metrics.error_rate.threshold_status === 'critical' ? 'urgent' : 'high',
        title: 'High Error Rate Detected',
        description: 'The system is experiencing elevated error rates that may impact user experience.',
        action_items: [
          'Review recent deployments for potential issues',
          'Check application logs for error patterns',
          'Verify database connectivity and performance',
          'Consider rolling back recent changes if error rate persists'
        ],
        estimated_impact: 'Reducing error rate will improve user satisfaction and system reliability'
      });
    }

    // Response time recommendations
    if (metrics.response_time.threshold_status !== 'safe') {
      recommendations.push({
        type: 'performance',
        priority: metrics.response_time.threshold_status === 'critical' ? 'urgent' : 'medium',
        title: 'Slow Response Times',
        description: 'API response times are higher than acceptable thresholds.',
        action_items: [
          'Analyze slow queries and optimize database performance',
          'Review caching strategies and hit rates',
          'Consider scaling up resources if needed',
          'Optimize application code for performance bottlenecks'
        ],
        estimated_impact: 'Improving response times will enhance user experience and system throughput'
      });
    }

    // Availability recommendations
    if (metrics.availability.threshold_status !== 'safe') {
      recommendations.push({
        type: 'reliability',
        priority: 'urgent',
        title: 'Availability Issues',
        description: 'System availability is below acceptable levels.',
        action_items: [
          'Investigate health check failures immediately',
          'Check for infrastructure issues or outages',
          'Verify load balancer and routing configuration',
          'Consider emergency rollback if issues persist'
        ],
        estimated_impact: 'Restoring availability is critical for maintaining service uptime'
      });
    }

    // Throughput recommendations
    if (metrics.throughput.threshold_status !== 'safe') {
      recommendations.push({
        type: 'capacity',
        priority: 'medium',
        title: 'Reduced Throughput',
        description: 'System throughput has decreased below expected levels.',
        action_items: [
          'Monitor traffic patterns and identify bottlenecks',
          'Check for resource constraints (CPU, memory, network)',
          'Review rate limiting and throttling configurations',
          'Consider horizontal scaling if sustained load increase'
        ],
        estimated_impact: 'Maintaining throughput ensures system can handle expected load'
      });
    }

    return recommendations;
  }

  /**
   * Get current safety status
   */
  getCurrentStatus(): {
    monitoring_active: boolean;
    overall_status: 'safe' | 'warning' | 'critical';
    active_alerts: number;
    enabled_thresholds: number;
    last_check: Date | null;
  } {
    const report = this.generateSafetyReport();
    
    return {
      monitoring_active: !!this.monitoringInterval,
      overall_status: report.overall_status,
      active_alerts: report.active_alerts.length,
      enabled_thresholds: Array.from(this.thresholds.values()).filter(t => t.enabled).length,
      last_check: this.metricsHistory.length > 0 ? this.metricsHistory[this.metricsHistory.length - 1].timestamp : null
    };
  }

  /**
   * Get safety alerts history
   */
  getAlertsHistory(limit: number = 50): SafetyAlert[] {
    return [...this.alerts]
      .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
      .slice(0, limit);
  }

  /**
   * Enable or disable alerting
   */
  setAlertingEnabled(enabled: boolean): void {
    this.alertingEnabled = enabled;
    console.log(`Safety alerting ${enabled ? 'enabled' : 'disabled'}`);
  }

  private generateAlertId(): string {
    return `alert-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for global use
 */
export const safetyMonitor = new SafetyMonitor();