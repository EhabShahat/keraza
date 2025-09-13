/**
 * Monitoring System Initialization
 * Sets up health monitoring and alerting for all consolidated functions
 */

import { healthMonitor, defaultConfigs } from './health-monitor';
import { alertingSystem, defaultAlertRules } from './alerting-system';

export interface MonitoringConfig {
  enabled: boolean;
  functions: {
    admin: boolean;
    public: boolean;
    attempts: boolean;
  };
  alerting: {
    enabled: boolean;
    channels: {
      console: boolean;
      webhook?: string;
      slack?: string;
    };
  };
  intervals: {
    healthCheck: number; // seconds
    metricsCollection: number; // seconds
    alertEvaluation: number; // seconds
  };
}

class MonitoringInitializer {
  private config: MonitoringConfig;
  private initialized = false;
  private intervals: NodeJS.Timeout[] = [];

  constructor(config: MonitoringConfig) {
    this.config = config;
  }

  /**
   * Initialize the monitoring system
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      console.warn('Monitoring system already initialized');
      return;
    }

    console.log('🔍 Initializing function monitoring system...');

    try {
      // Initialize health monitoring
      await this.initializeHealthMonitoring();

      // Initialize alerting system
      if (this.config.alerting.enabled) {
        await this.initializeAlerting();
      }

      // Start monitoring loops
      this.startMonitoringLoops();

      this.initialized = true;
      console.log('✅ Monitoring system initialized successfully');

    } catch (error) {
      console.error('❌ Failed to initialize monitoring system:', error);
      throw error;
    }
  }

  /**
   * Initialize health monitoring for enabled functions
   */
  private async initializeHealthMonitoring(): Promise<void> {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';

    // Register admin API monitoring
    if (this.config.functions.admin) {
      healthMonitor.registerFunction('admin-api', {
        ...defaultConfigs.admin,
        endpoint: `${baseUrl}/api/admin/health`,
        interval: this.config.intervals.healthCheck * 1000
      });
      console.log('📊 Registered admin API monitoring');
    }

    // Register public API monitoring
    if (this.config.functions.public) {
      healthMonitor.registerFunction('public-api', {
        ...defaultConfigs.public,
        endpoint: `${baseUrl}/api/public/health`,
        interval: this.config.intervals.healthCheck * 1000
      });
      console.log('📊 Registered public API monitoring');
    }

    // Register attempts API monitoring
    if (this.config.functions.attempts) {
      healthMonitor.registerFunction('attempts-api', {
        ...defaultConfigs.attempts,
        endpoint: `${baseUrl}/api/attempts/health`,
        interval: this.config.intervals.healthCheck * 1000
      });
      console.log('📊 Registered attempts API monitoring');
    }
  }

  /**
   * Initialize alerting system
   */
  private async initializeAlerting(): Promise<void> {
    // Add default alert rules
    for (const rule of defaultAlertRules) {
      // Configure channels based on config
      const channels = [];
      
      if (this.config.alerting.channels.console) {
        channels.push({ type: 'console' as const, config: {} });
      }
      
      if (this.config.alerting.channels.webhook) {
        channels.push({
          type: 'webhook' as const,
          config: { url: this.config.alerting.channels.webhook }
        });
      }
      
      if (this.config.alerting.channels.slack) {
        channels.push({
          type: 'slack' as const,
          config: { webhook_url: this.config.alerting.channels.slack }
        });
      }

      alertingSystem.addRule({
        ...rule,
        channels
      });
    }

    console.log('🚨 Alerting system configured with default rules');
  }

  /**
   * Start monitoring loops
   */
  private startMonitoringLoops(): void {
    // Alert evaluation loop
    if (this.config.alerting.enabled) {
      const alertInterval = setInterval(() => {
        this.evaluateAlerts();
      }, this.config.intervals.alertEvaluation * 1000);
      
      this.intervals.push(alertInterval);
    }

    // Metrics cleanup loop (every hour)
    const cleanupInterval = setInterval(() => {
      this.cleanupOldData();
    }, 60 * 60 * 1000);
    
    this.intervals.push(cleanupInterval);

    console.log('🔄 Monitoring loops started');
  }

  /**
   * Evaluate alerts for all monitored functions
   */
  private evaluateAlerts(): void {
    const healthStatuses = healthMonitor.getAllHealthStatus();
    
    for (const health of healthStatuses) {
      alertingSystem.evaluateHealth(health.function_name, health);
    }
  }

  /**
   * Clean up old monitoring data
   */
  private cleanupOldData(): void {
    // Clear old resolved alerts (older than 24 hours)
    alertingSystem.clearOldAlerts(24);
    
    console.log('🧹 Cleaned up old monitoring data');
  }

  /**
   * Get monitoring status
   */
  getStatus(): {
    initialized: boolean;
    health_statuses: any[];
    active_alerts: any[];
    config: MonitoringConfig;
  } {
    return {
      initialized: this.initialized,
      health_statuses: healthMonitor.getAllHealthStatus(),
      active_alerts: alertingSystem.getActiveAlerts(),
      config: this.config
    };
  }

  /**
   * Shutdown monitoring system
   */
  shutdown(): void {
    if (!this.initialized) {
      return;
    }

    // Clear all intervals
    for (const interval of this.intervals) {
      clearInterval(interval);
    }
    this.intervals = [];

    // Shutdown health monitor
    healthMonitor.shutdown();

    this.initialized = false;
    console.log('🛑 Monitoring system shut down');
  }
}

// Default configuration
export const defaultMonitoringConfig: MonitoringConfig = {
  enabled: true,
  functions: {
    admin: true,
    public: true,
    attempts: true
  },
  alerting: {
    enabled: true,
    channels: {
      console: true
    }
  },
  intervals: {
    healthCheck: 30, // 30 seconds
    metricsCollection: 60, // 1 minute
    alertEvaluation: 30 // 30 seconds
  }
};

// Global monitoring instance
let monitoringInstance: MonitoringInitializer | null = null;

/**
 * Initialize monitoring with configuration
 */
export async function initializeMonitoring(config: Partial<MonitoringConfig> = {}): Promise<MonitoringInitializer> {
  const finalConfig = { ...defaultMonitoringConfig, ...config };
  
  if (monitoringInstance) {
    console.warn('Monitoring already initialized, shutting down previous instance');
    monitoringInstance.shutdown();
  }

  monitoringInstance = new MonitoringInitializer(finalConfig);
  await monitoringInstance.initialize();
  
  return monitoringInstance;
}

/**
 * Get current monitoring instance
 */
export function getMonitoringInstance(): MonitoringInitializer | null {
  return monitoringInstance;
}

/**
 * Shutdown monitoring
 */
export function shutdownMonitoring(): void {
  if (monitoringInstance) {
    monitoringInstance.shutdown();
    monitoringInstance = null;
  }
}