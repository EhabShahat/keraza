/**
 * Alerting System for Function Monitoring
 * Handles alerts for function failures and performance degradation
 */

import { FunctionHealth, PerformanceMetrics } from './health-monitor';

export interface AlertRule {
  id: string;
  name: string;
  condition: AlertCondition;
  severity: 'low' | 'medium' | 'high' | 'critical';
  enabled: boolean;
  cooldown: number; // Minutes between alerts
  channels: AlertChannel[];
}

export interface AlertCondition {
  metric: 'response_time' | 'error_rate' | 'success_rate' | 'memory_usage' | 'status';
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  threshold: number | string;
  duration: number; // Minutes the condition must persist
}

export interface AlertChannel {
  type: 'console' | 'webhook' | 'email' | 'slack';
  config: Record<string, any>;
}

export interface Alert {
  id: string;
  rule_id: string;
  function_name: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  message: string;
  timestamp: Date;
  resolved: boolean;
  resolved_at?: Date;
  metadata: Record<string, any>;
}

class AlertingSystem {
  private rules: Map<string, AlertRule> = new Map();
  private activeAlerts: Map<string, Alert> = new Map();
  private lastAlertTime: Map<string, Date> = new Map();
  private conditionHistory: Map<string, { timestamp: Date; met: boolean }[]> = new Map();

  /**
   * Add an alert rule
   */
  addRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Remove an alert rule
   */
  removeRule(ruleId: string): void {
    this.rules.delete(ruleId);
  }

  /**
   * Update an alert rule
   */
  updateRule(rule: AlertRule): void {
    this.rules.set(rule.id, rule);
  }

  /**
   * Get all alert rules
   */
  getRules(): AlertRule[] {
    return Array.from(this.rules.values());
  }

  /**
   * Evaluate health status against alert rules
   */
  evaluateHealth(functionName: string, health: FunctionHealth): void {
    for (const rule of this.rules.values()) {
      if (!rule.enabled) continue;

      const conditionMet = this.evaluateCondition(rule.condition, health);
      const historyKey = `${rule.id}-${functionName}`;
      
      // Track condition history
      const history = this.conditionHistory.get(historyKey) || [];
      history.push({ timestamp: new Date(), met: conditionMet });
      
      // Keep only recent history (last hour)
      const cutoff = new Date(Date.now() - 60 * 60 * 1000);
      const recentHistory = history.filter(h => h.timestamp >= cutoff);
      this.conditionHistory.set(historyKey, recentHistory);

      // Check if condition has been met for the required duration
      if (this.shouldTriggerAlert(rule, recentHistory, functionName)) {
        this.triggerAlert(rule, functionName, health);
      } else if (this.shouldResolveAlert(rule, recentHistory, functionName)) {
        this.resolveAlert(rule.id, functionName);
      }
    }
  }

  /**
   * Evaluate a single condition against health data
   */
  private evaluateCondition(condition: AlertCondition, health: FunctionHealth): boolean {
    let value: number | string;
    
    switch (condition.metric) {
      case 'response_time':
        value = health.response_time;
        break;
      case 'error_rate':
        value = health.error_rate;
        break;
      case 'success_rate':
        value = health.success_rate;
        break;
      case 'memory_usage':
        value = health.memory_usage;
        break;
      case 'status':
        value = health.status;
        break;
      default:
        return false;
    }

    switch (condition.operator) {
      case 'gt':
        return Number(value) > Number(condition.threshold);
      case 'lt':
        return Number(value) < Number(condition.threshold);
      case 'gte':
        return Number(value) >= Number(condition.threshold);
      case 'lte':
        return Number(value) <= Number(condition.threshold);
      case 'eq':
        return value === condition.threshold;
      default:
        return false;
    }
  }

  /**
   * Check if an alert should be triggered
   */
  private shouldTriggerAlert(rule: AlertRule, history: { timestamp: Date; met: boolean }[], functionName: string): boolean {
    const alertKey = `${rule.id}-${functionName}`;
    
    // Check cooldown
    const lastAlert = this.lastAlertTime.get(alertKey);
    if (lastAlert) {
      const cooldownEnd = new Date(lastAlert.getTime() + rule.cooldown * 60 * 1000);
      if (new Date() < cooldownEnd) {
        return false;
      }
    }

    // Check if condition has been met for required duration
    const durationMs = rule.condition.duration * 60 * 1000;
    const cutoff = new Date(Date.now() - durationMs);
    const relevantHistory = history.filter(h => h.timestamp >= cutoff);
    
    // All recent checks must meet the condition
    return relevantHistory.length > 0 && relevantHistory.every(h => h.met);
  }

  /**
   * Check if an alert should be resolved
   */
  private shouldResolveAlert(rule: AlertRule, history: { timestamp: Date; met: boolean }[], functionName: string): boolean {
    const alertKey = `${rule.id}-${functionName}`;
    const activeAlert = this.activeAlerts.get(alertKey);
    
    if (!activeAlert || activeAlert.resolved) {
      return false;
    }

    // Check if condition has not been met for the last few checks
    const recentChecks = history.slice(-3); // Last 3 checks
    return recentChecks.length >= 2 && recentChecks.every(h => !h.met);
  }

  /**
   * Trigger an alert
   */
  private async triggerAlert(rule: AlertRule, functionName: string, health: FunctionHealth): Promise<void> {
    const alertKey = `${rule.id}-${functionName}`;
    
    // Check if alert is already active
    if (this.activeAlerts.has(alertKey)) {
      return;
    }

    const alert: Alert = {
      id: `${rule.id}-${functionName}-${Date.now()}`,
      rule_id: rule.id,
      function_name: functionName,
      severity: rule.severity,
      message: this.generateAlertMessage(rule, functionName, health),
      timestamp: new Date(),
      resolved: false,
      metadata: {
        health_status: health,
        rule_condition: rule.condition
      }
    };

    this.activeAlerts.set(alertKey, alert);
    this.lastAlertTime.set(alertKey, new Date());

    // Send alert through configured channels
    await this.sendAlert(alert, rule.channels);

    console.warn(`🚨 Alert triggered: ${alert.message}`);
  }

  /**
   * Resolve an alert
   */
  private async resolveAlert(ruleId: string, functionName: string): Promise<void> {
    const alertKey = `${ruleId}-${functionName}`;
    const alert = this.activeAlerts.get(alertKey);
    
    if (!alert || alert.resolved) {
      return;
    }

    alert.resolved = true;
    alert.resolved_at = new Date();

    console.info(`✅ Alert resolved: ${alert.message}`);
  }

  /**
   * Generate alert message
   */
  private generateAlertMessage(rule: AlertRule, functionName: string, health: FunctionHealth): string {
    const condition = rule.condition;
    let value: number | string;
    
    switch (condition.metric) {
      case 'response_time':
        value = `${health.response_time}ms`;
        break;
      case 'error_rate':
        value = `${health.error_rate.toFixed(2)}%`;
        break;
      case 'success_rate':
        value = `${health.success_rate.toFixed(2)}%`;
        break;
      case 'memory_usage':
        value = `${(health.memory_usage / 1024 / 1024).toFixed(2)}MB`;
        break;
      case 'status':
        value = health.status;
        break;
      default:
        value = 'unknown';
    }

    return `Function ${functionName}: ${condition.metric} is ${value} (threshold: ${condition.threshold})`;
  }

  /**
   * Send alert through configured channels
   */
  private async sendAlert(alert: Alert, channels: AlertChannel[]): Promise<void> {
    for (const channel of channels) {
      try {
        await this.sendToChannel(alert, channel);
      } catch (error) {
        console.error(`Failed to send alert to ${channel.type}:`, error);
      }
    }
  }

  /**
   * Send alert to a specific channel
   */
  private async sendToChannel(alert: Alert, channel: AlertChannel): Promise<void> {
    switch (channel.type) {
      case 'console':
        console.log(`[${alert.severity.toUpperCase()}] ${alert.message}`);
        break;
        
      case 'webhook':
        if (channel.config.url) {
          await fetch(channel.config.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(alert)
          });
        }
        break;
        
      case 'slack':
        if (channel.config.webhook_url) {
          await fetch(channel.config.webhook_url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              text: `🚨 ${alert.severity.toUpperCase()} Alert`,
              attachments: [{
                color: this.getSeverityColor(alert.severity),
                fields: [
                  { title: 'Function', value: alert.function_name, short: true },
                  { title: 'Message', value: alert.message, short: false },
                  { title: 'Time', value: alert.timestamp.toISOString(), short: true }
                ]
              }]
            })
          });
        }
        break;
    }
  }

  /**
   * Get color for alert severity
   */
  private getSeverityColor(severity: string): string {
    switch (severity) {
      case 'low': return '#36a64f';
      case 'medium': return '#ff9500';
      case 'high': return '#ff6b35';
      case 'critical': return '#ff0000';
      default: return '#808080';
    }
  }

  /**
   * Get active alerts
   */
  getActiveAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values()).filter(alert => !alert.resolved);
  }

  /**
   * Get all alerts (including resolved)
   */
  getAllAlerts(): Alert[] {
    return Array.from(this.activeAlerts.values());
  }

  /**
   * Clear resolved alerts older than specified hours
   */
  clearOldAlerts(hours: number = 24): void {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    
    for (const [key, alert] of this.activeAlerts.entries()) {
      if (alert.resolved && alert.resolved_at && alert.resolved_at < cutoff) {
        this.activeAlerts.delete(key);
      }
    }
  }
}

// Singleton instance
export const alertingSystem = new AlertingSystem();

// Default alert rules
export const defaultAlertRules: AlertRule[] = [
  {
    id: 'high-response-time',
    name: 'High Response Time',
    condition: {
      metric: 'response_time',
      operator: 'gt',
      threshold: 5000, // 5 seconds
      duration: 2 // 2 minutes
    },
    severity: 'high',
    enabled: true,
    cooldown: 10, // 10 minutes
    channels: [{ type: 'console', config: {} }]
  },
  {
    id: 'high-error-rate',
    name: 'High Error Rate',
    condition: {
      metric: 'error_rate',
      operator: 'gt',
      threshold: 10, // 10%
      duration: 1 // 1 minute
    },
    severity: 'critical',
    enabled: true,
    cooldown: 5, // 5 minutes
    channels: [{ type: 'console', config: {} }]
  },
  {
    id: 'function-unhealthy',
    name: 'Function Unhealthy',
    condition: {
      metric: 'status',
      operator: 'eq',
      threshold: 'unhealthy',
      duration: 1 // 1 minute
    },
    severity: 'critical',
    enabled: true,
    cooldown: 5, // 5 minutes
    channels: [{ type: 'console', config: {} }]
  },
  {
    id: 'low-success-rate',
    name: 'Low Success Rate',
    condition: {
      metric: 'success_rate',
      operator: 'lt',
      threshold: 95, // 95%
      duration: 3 // 3 minutes
    },
    severity: 'medium',
    enabled: true,
    cooldown: 15, // 15 minutes
    channels: [{ type: 'console', config: {} }]
  }
];