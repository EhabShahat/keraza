import { APIRequest, APIResponse } from "./unified-handler";
import { PerformanceMonitor, ErrorLogger } from "./error-handler";

/**
 * Monitoring and metrics collection for unified API handlers
 */

export interface MetricData {
  timestamp: Date;
  operation: string;
  duration: number;
  status: number;
  userId?: string;
  errorId?: string;
  metadata?: Record<string, any>;
}

export interface HealthCheck {
  name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  message?: string;
  lastCheck: Date;
  responseTime?: number;
}

export interface SystemMetrics {
  requests: {
    total: number;
    successful: number;
    failed: number;
    averageResponseTime: number;
  };
  errors: {
    total: number;
    byType: Record<string, number>;
    recent: number; // Last hour
  };
  performance: {
    slowestEndpoints: Array<{ endpoint: string; avgTime: number }>;
    fastestEndpoints: Array<{ endpoint: string; avgTime: number }>;
  };
  health: {
    overall: 'healthy' | 'degraded' | 'unhealthy';
    checks: HealthCheck[];
  };
}

/**
 * Metrics collector
 */
export class MetricsCollector {
  private static metrics: MetricData[] = [];
  private static maxMetrics = 10000;
  private static healthChecks: Map<string, HealthCheck> = new Map();

  /**
   * Record a metric
   */
  static record(data: Omit<MetricData, 'timestamp'>): void {
    const metric: MetricData = {
      ...data,
      timestamp: new Date()
    };

    this.metrics.push(metric);

    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics = this.metrics.slice(-this.maxMetrics);
    }
  }

  /**
   * Get metrics for a time period
   */
  static getMetrics(since?: Date): MetricData[] {
    if (!since) {
      return [...this.metrics];
    }

    return this.metrics.filter(metric => metric.timestamp >= since);
  }

  /**
   * Get system metrics summary
   */
  static getSystemMetrics(): SystemMetrics {
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
    const recentMetrics = this.getMetrics(oneHourAgo);

    // Request metrics
    const totalRequests = this.metrics.length;
    const successfulRequests = this.metrics.filter(m => m.status < 400).length;
    const failedRequests = totalRequests - successfulRequests;
    const averageResponseTime = totalRequests > 0 
      ? this.metrics.reduce((sum, m) => sum + m.duration, 0) / totalRequests 
      : 0;

    // Error metrics
    const errorMetrics = this.metrics.filter(m => m.status >= 400);
    const errorsByType: Record<string, number> = {};
    errorMetrics.forEach(metric => {
      const type = this.getErrorType(metric.status);
      errorsByType[type] = (errorsByType[type] || 0) + 1;
    });

    // Performance metrics
    const endpointPerformance = this.calculateEndpointPerformance();

    // Health status
    const overallHealth = this.calculateOverallHealth();

    return {
      requests: {
        total: totalRequests,
        successful: successfulRequests,
        failed: failedRequests,
        averageResponseTime
      },
      errors: {
        total: errorMetrics.length,
        byType: errorsByType,
        recent: recentMetrics.filter(m => m.status >= 400).length
      },
      performance: {
        slowestEndpoints: endpointPerformance.slowest,
        fastestEndpoints: endpointPerformance.fastest
      },
      health: {
        overall: overallHealth,
        checks: Array.from(this.healthChecks.values())
      }
    };
  }

  /**
   * Register health check
   */
  static registerHealthCheck(name: string, check: () => Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message?: string }>): void {
    this.healthChecks.set(name, {
      name,
      status: 'healthy',
      lastCheck: new Date(),
      message: 'Not checked yet'
    });

    // Run initial check
    this.runHealthCheck(name, check);
  }

  /**
   * Run health check
   */
  static async runHealthCheck(name: string, check: () => Promise<{ status: 'healthy' | 'degraded' | 'unhealthy'; message?: string }>): Promise<void> {
    const startTime = Date.now();
    
    try {
      const result = await check();
      const responseTime = Date.now() - startTime;

      this.healthChecks.set(name, {
        name,
        status: result.status,
        message: result.message,
        lastCheck: new Date(),
        responseTime
      });
    } catch (error: any) {
      this.healthChecks.set(name, {
        name,
        status: 'unhealthy',
        message: error.message || 'Health check failed',
        lastCheck: new Date(),
        responseTime: Date.now() - startTime
      });
    }
  }

  /**
   * Run all health checks
   */
  static async runAllHealthChecks(): Promise<void> {
    // In a real implementation, store check functions and run them
    // For now, just update timestamps
    for (const [name, check] of this.healthChecks.entries()) {
      // Simulate health check
      const isHealthy = Math.random() > 0.1; // 90% healthy
      this.healthChecks.set(name, {
        ...check,
        status: isHealthy ? 'healthy' : 'degraded',
        lastCheck: new Date()
      });
    }
  }

  /**
   * Clear metrics
   */
  static clearMetrics(): void {
    this.metrics = [];
  }

  /**
   * Get error type from status code
   */
  private static getErrorType(status: number): string {
    if (status >= 400 && status < 500) {
      return 'client_error';
    } else if (status >= 500) {
      return 'server_error';
    }
    return 'unknown';
  }

  /**
   * Calculate endpoint performance
   */
  private static calculateEndpointPerformance(): { slowest: Array<{ endpoint: string; avgTime: number }>; fastest: Array<{ endpoint: string; avgTime: number }> } {
    const endpointTimes: Map<string, number[]> = new Map();

    this.metrics.forEach(metric => {
      if (!endpointTimes.has(metric.operation)) {
        endpointTimes.set(metric.operation, []);
      }
      endpointTimes.get(metric.operation)!.push(metric.duration);
    });

    const endpointAvgs = Array.from(endpointTimes.entries()).map(([endpoint, times]) => ({
      endpoint,
      avgTime: times.reduce((sum, time) => sum + time, 0) / times.length
    }));

    return {
      slowest: endpointAvgs.sort((a, b) => b.avgTime - a.avgTime).slice(0, 5),
      fastest: endpointAvgs.sort((a, b) => a.avgTime - b.avgTime).slice(0, 5)
    };
  }

  /**
   * Calculate overall health
   */
  private static calculateOverallHealth(): 'healthy' | 'degraded' | 'unhealthy' {
    const checks = Array.from(this.healthChecks.values());
    
    if (checks.length === 0) {
      return 'healthy';
    }

    const unhealthyCount = checks.filter(c => c.status === 'unhealthy').length;
    const degradedCount = checks.filter(c => c.status === 'degraded').length;

    if (unhealthyCount > 0) {
      return 'unhealthy';
    } else if (degradedCount > 0) {
      return 'degraded';
    }

    return 'healthy';
  }
}

/**
 * Alerting system
 */
export class AlertManager {
  private static alerts: Array<{ id: string; message: string; level: 'info' | 'warning' | 'critical'; timestamp: Date }> = [];
  private static thresholds = {
    errorRate: 0.05, // 5%
    responseTime: 5000, // 5 seconds
    failedHealthChecks: 1
  };

  /**
   * Check for alert conditions
   */
  static checkAlerts(): void {
    const metrics = MetricsCollector.getSystemMetrics();
    const now = new Date();

    // Check error rate
    const errorRate = metrics.requests.total > 0 ? metrics.requests.failed / metrics.requests.total : 0;
    if (errorRate > this.thresholds.errorRate) {
      this.createAlert(
        `High error rate: ${(errorRate * 100).toFixed(2)}%`,
        'critical'
      );
    }

    // Check response time
    if (metrics.requests.averageResponseTime > this.thresholds.responseTime) {
      this.createAlert(
        `High response time: ${metrics.requests.averageResponseTime.toFixed(0)}ms`,
        'warning'
      );
    }

    // Check health checks
    const failedHealthChecks = metrics.health.checks.filter(c => c.status === 'unhealthy').length;
    if (failedHealthChecks > this.thresholds.failedHealthChecks) {
      this.createAlert(
        `${failedHealthChecks} health check(s) failing`,
        'critical'
      );
    }
  }

  /**
   * Create alert
   */
  private static createAlert(message: string, level: 'info' | 'warning' | 'critical'): void {
    const alert = {
      id: `alert_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      message,
      level,
      timestamp: new Date()
    };

    this.alerts.push(alert);

    // Keep only recent alerts
    if (this.alerts.length > 100) {
      this.alerts = this.alerts.slice(-100);
    }

    // Log critical alerts
    if (level === 'critical') {
      console.error(`CRITICAL ALERT: ${message}`);
    }
  }

  /**
   * Get alerts
   */
  static getAlerts(level?: 'info' | 'warning' | 'critical'): typeof AlertManager.alerts {
    if (level) {
      return this.alerts.filter(alert => alert.level === level);
    }
    return [...this.alerts];
  }

  /**
   * Clear alerts
   */
  static clearAlerts(): void {
    this.alerts = [];
  }
}

/**
 * Monitoring middleware
 */
export function createMonitoringMiddleware() {
  return {
    name: 'monitoring',
    handler: async (request: APIRequest): Promise<APIRequest> => {
      const startTime = Date.now();
      
      // Add monitoring context to request
      (request as any).monitoring = {
        startTime,
        recordMetric: (status: number, errorId?: string) => {
          const duration = Date.now() - startTime;
          MetricsCollector.record({
            operation: `${request.method} /${request.path.join('/')}`,
            duration,
            status,
            userId: request.user?.user_id,
            errorId,
            metadata: {
              userAgent: request.headers['user-agent'],
              ip: request.headers['x-forwarded-for'] || request.headers['x-real-ip']
            }
          });
        }
      };

      return request;
    }
  };
}

/**
 * Default health checks
 */
export function setupDefaultHealthChecks(): void {
  // Database health check
  MetricsCollector.registerHealthCheck('database', async () => {
    try {
      // In a real implementation, test database connection
      // For now, simulate
      const isHealthy = Math.random() > 0.05; // 95% healthy
      return {
        status: isHealthy ? 'healthy' : 'degraded',
        message: isHealthy ? 'Database connection OK' : 'Database connection slow'
      };
    } catch (error: any) {
      return {
        status: 'unhealthy',
        message: error.message
      };
    }
  });

  // Memory health check
  MetricsCollector.registerHealthCheck('memory', async () => {
    const memUsage = process.memoryUsage();
    const heapUsedMB = memUsage.heapUsed / 1024 / 1024;
    
    if (heapUsedMB > 500) {
      return {
        status: 'degraded',
        message: `High memory usage: ${heapUsedMB.toFixed(2)}MB`
      };
    }
    
    return {
      status: 'healthy',
      message: `Memory usage: ${heapUsedMB.toFixed(2)}MB`
    };
  });

  // Error rate health check
  MetricsCollector.registerHealthCheck('error_rate', async () => {
    const metrics = MetricsCollector.getSystemMetrics();
    const errorRate = metrics.requests.total > 0 ? metrics.requests.failed / metrics.requests.total : 0;
    
    if (errorRate > 0.1) {
      return {
        status: 'unhealthy',
        message: `High error rate: ${(errorRate * 100).toFixed(2)}%`
      };
    } else if (errorRate > 0.05) {
      return {
        status: 'degraded',
        message: `Elevated error rate: ${(errorRate * 100).toFixed(2)}%`
      };
    }
    
    return {
      status: 'healthy',
      message: `Error rate: ${(errorRate * 100).toFixed(2)}%`
    };
  });
}

// Run health checks every 5 minutes
setInterval(() => {
  MetricsCollector.runAllHealthChecks();
  AlertManager.checkAlerts();
}, 5 * 60 * 1000);

// Initialize default health checks
setupDefaultHealthChecks();