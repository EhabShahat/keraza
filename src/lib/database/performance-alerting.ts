/**
 * Database Performance Alerting System
 * Provides real-time alerting and notification for database performance issues
 */

import { performanceMonitor, PerformanceAlert } from './performance-monitor';

interface AlertRule {
  id: string;
  name: string;
  condition: (metrics: any) => boolean;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  cooldown: number; // Minutes between alerts
  enabled: boolean;
}

interface AlertChannel {
  type: 'console' | 'webhook' | 'email';
  config: any;
  enabled: boolean;
}

class DatabaseAlertingSystem {
  private static instance: DatabaseAlertingSystem;
  private alertRules: Map<string, AlertRule> = new Map();
  private alertChannels: AlertChannel[] = [];
  private lastAlertTimes: Map<string, Date> = new Map();
  private alertHistory: PerformanceAlert[] = [];

  private constructor() {
    this.initializeDefaultRules();
    this.setupAlertListener();
  }

  static getInstance(): DatabaseAlertingSystem {
    if (!DatabaseAlertingSystem.instance) {
      DatabaseAlertingSystem.instance = new DatabaseAlertingSystem();
    }
    return DatabaseAlertingSystem.instance;
  }

  /**
   * Initialize default alert rules
   */
  private initializeDefaultRules(): void {
    const defaultRules: Omit<AlertRule, 'id'>[] = [
      {
        name: 'High Response Time',
        condition: (metrics) => metrics.averageResponseTime > 1000,
        severity: 'high',
        message: 'Database response time is above 1 second',
        cooldown: 5,
        enabled: true
      },
      {
        name: 'Critical Response Time',
        condition: (metrics) => metrics.averageResponseTime > 3000,
        severity: 'critical',
        message: 'Database response time is critically high (>3s)',
        cooldown: 2,
        enabled: true
      },
      {
        name: 'High Error Rate',
        condition: (metrics) => metrics.errorRate > 0.05,
        severity: 'high',
        message: 'Database error rate is above 5%',
        cooldown: 5,
        enabled: true
      },
      {
        name: 'Critical Error Rate',
        condition: (metrics) => metrics.errorRate > 0.15,
        severity: 'critical',
        message: 'Database error rate is critically high (>15%)',
        cooldown: 2,
        enabled: true
      },
      {
        name: 'Connection Pool Full',
        condition: (metrics) => metrics.connectionPoolUtilization > 0.9,
        severity: 'critical',
        message: 'Database connection pool is nearly full',
        cooldown: 3,
        enabled: true
      },
      {
        name: 'Many Slow Queries',
        condition: (metrics) => metrics.slowQueryCount > 10,
        severity: 'medium',
        message: 'Multiple slow queries detected',
        cooldown: 10,
        enabled: true
      },
      {
        name: 'No Database Activity',
        condition: (metrics) => metrics.queryCount === 0,
        severity: 'medium',
        message: 'No database activity detected - possible connection issue',
        cooldown: 15,
        enabled: true
      }
    ];

    defaultRules.forEach(rule => {
      const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
      this.alertRules.set(id, { ...rule, id });
    });
  }

  /**
   * Setup alert listener
   */
  private setupAlertListener(): void {
    performanceMonitor.onAlert((alert) => {
      this.handleAlert(alert);
    });

    // Check rules periodically
    setInterval(() => {
      this.checkAlertRules();
    }, 30000); // Every 30 seconds
  }

  /**
   * Check all alert rules against current metrics
   */
  private async checkAlertRules(): Promise<void> {
    try {
      const metrics = performanceMonitor.getPerformanceMetrics(5 * 60 * 1000); // Last 5 minutes
      
      for (const rule of this.alertRules.values()) {
        if (!rule.enabled) continue;

        // Check cooldown
        const lastAlert = this.lastAlertTimes.get(rule.id);
        if (lastAlert) {
          const cooldownMs = rule.cooldown * 60 * 1000;
          if (Date.now() - lastAlert.getTime() < cooldownMs) {
            continue;
          }
        }

        // Check condition
        if (rule.condition(metrics)) {
          const alert: PerformanceAlert = {
            id: `alert_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
            type: 'slow_query', // Default type, could be enhanced
            severity: rule.severity,
            message: rule.message,
            timestamp: new Date(),
            metadata: { rule: rule.name, metrics }
          };

          this.handleAlert(alert);
          this.lastAlertTimes.set(rule.id, new Date());
        }
      }
    } catch (error) {
      console.error('Alert rule checking error:', error);
    }
  }

  /**
   * Handle incoming alert
   */
  private async handleAlert(alert: PerformanceAlert): Promise<void> {
    // Store in history
    this.alertHistory.push(alert);
    if (this.alertHistory.length > 500) {
      this.alertHistory = this.alertHistory.slice(-500);
    }

    // Send to all enabled channels
    for (const channel of this.alertChannels) {
      if (!channel.enabled) continue;

      try {
        await this.sendAlert(alert, channel);
      } catch (error) {
        console.error(`Failed to send alert via ${channel.type}:`, error);
      }
    }

    // Log critical alerts
    if (alert.severity === 'critical') {
      console.error('🚨 CRITICAL DATABASE ALERT:', {
        message: alert.message,
        timestamp: alert.timestamp,
        metadata: alert.metadata
      });
    }
  }

  /**
   * Send alert to specific channel
   */
  private async sendAlert(alert: PerformanceAlert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        const emoji = this.getSeverityEmoji(alert.severity);
        console.warn(`${emoji} Database Alert [${alert.severity.toUpperCase()}]: ${alert.message}`);
        break;

      case 'webhook':
        if (channel.config.url) {
          const response = await fetch(channel.config.url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              ...(channel.config.headers || {})
            },
            body: JSON.stringify({
              alert,
              timestamp: alert.timestamp.toISOString(),
              service: 'database-monitor'
            })
          });

          if (!response.ok) {
            throw new Error(`Webhook failed: ${response.status}`);
          }
        }
        break;

      case 'email':
        // Email implementation would go here
        // For now, just log
        console.log(`Email alert would be sent: ${alert.message}`);
        break;
    }
  }

  /**
   * Get emoji for severity level
   */
  private getSeverityEmoji(severity: string): string {
    switch (severity) {
      case 'critical': return '🚨';
      case 'high': return '⚠️';
      case 'medium': return '⚡';
      case 'low': return 'ℹ️';
      default: return '📊';
    }
  }

  /**
   * Add custom alert rule
   */
  addAlertRule(rule: Omit<AlertRule, 'id'>): string {
    const id = `rule_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    this.alertRules.set(id, { ...rule, id });
    return id;
  }

  /**
   * Remove alert rule
   */
  removeAlertRule(id: string): boolean {
    return this.alertRules.delete(id);
  }

  /**
   * Update alert rule
   */
  updateAlertRule(id: string, updates: Partial<AlertRule>): boolean {
    const rule = this.alertRules.get(id);
    if (!rule) return false;

    this.alertRules.set(id, { ...rule, ...updates });
    return true;
  }

  /**
   * Add alert channel
   */
  addAlertChannel(channel: AlertChannel): void {
    this.alertChannels.push(channel);
  }

  /**
   * Remove alert channel
   */
  removeAlertChannel(type: string): void {
    this.alertChannels = this.alertChannels.filter(c => c.type !== type);
  }

  /**
   * Get all alert rules
   */
  getAlertRules(): AlertRule[] {
    return Array.from(this.alertRules.values());
  }

  /**
   * Get alert history
   */
  getAlertHistory(limit?: number): PerformanceAlert[] {
    const history = [...this.alertHistory].reverse();
    return limit ? history.slice(0, limit) : history;
  }

  /**
   * Get alert statistics
   */
  getAlertStatistics(timeWindow?: number): {
    totalAlerts: number;
    alertsBySeverity: Record<string, number>;
    alertsByType: Record<string, number>;
    recentAlerts: PerformanceAlert[];
  } {
    const cutoff = timeWindow ? new Date(Date.now() - timeWindow) : new Date(0);
    const relevantAlerts = this.alertHistory.filter(a => a.timestamp >= cutoff);

    const alertsBySeverity: Record<string, number> = {};
    const alertsByType: Record<string, number> = {};

    relevantAlerts.forEach(alert => {
      alertsBySeverity[alert.severity] = (alertsBySeverity[alert.severity] || 0) + 1;
      alertsByType[alert.type] = (alertsByType[alert.type] || 0) + 1;
    });

    return {
      totalAlerts: relevantAlerts.length,
      alertsBySeverity,
      alertsByType,
      recentAlerts: relevantAlerts.slice(-10)
    };
  }

  /**
   * Test alert system
   */
  async testAlert(severity: 'low' | 'medium' | 'high' | 'critical' = 'medium'): Promise<void> {
    const testAlert: PerformanceAlert = {
      id: `test_${Date.now()}`,
      type: 'slow_query',
      severity,
      message: `Test alert - ${severity} severity`,
      timestamp: new Date(),
      metadata: { test: true }
    };

    await this.handleAlert(testAlert);
  }
}

export const alertingSystem = DatabaseAlertingSystem.getInstance();
export type { AlertRule, AlertChannel };