/**
 * Function Health Monitoring System
 * Provides comprehensive health checks and performance monitoring for consolidated functions
 */

export interface FunctionHealth {
  function_name: string;
  status: 'healthy' | 'degraded' | 'unhealthy';
  response_time: number;
  error_rate: number;
  memory_usage: number;
  cpu_usage: number;
  last_check: Date;
  uptime: number;
  success_rate: number;
}

export interface HealthCheckConfig {
  endpoint: string;
  timeout: number;
  interval: number;
  retries: number;
  thresholds: {
    response_time: number;
    error_rate: number;
    memory_usage: number;
  };
}

export interface PerformanceMetrics {
  timestamp: Date;
  function_name: string;
  invocation_count: number;
  avg_response_time: number;
  error_count: number;
  memory_peak: number;
  cpu_peak: number;
}

class HealthMonitor {
  private metrics: Map<string, PerformanceMetrics[]> = new Map();
  private healthStatus: Map<string, FunctionHealth> = new Map();
  private checkIntervals: Map<string, NodeJS.Timeout> = new Map();

  /**
   * Register a function for health monitoring
   */
  registerFunction(functionName: string, config: HealthCheckConfig): void {
    // Initialize metrics storage
    if (!this.metrics.has(functionName)) {
      this.metrics.set(functionName, []);
    }

    // Initialize health status
    this.healthStatus.set(functionName, {
      function_name: functionName,
      status: 'healthy',
      response_time: 0,
      error_rate: 0,
      memory_usage: 0,
      cpu_usage: 0,
      last_check: new Date(),
      uptime: 0,
      success_rate: 100
    });

    // Start periodic health checks
    this.startHealthChecks(functionName, config);
  }

  /**
   * Start periodic health checks for a function
   */
  private startHealthChecks(functionName: string, config: HealthCheckConfig): void {
    const interval = setInterval(async () => {
      await this.performHealthCheck(functionName, config);
    }, config.interval);

    this.checkIntervals.set(functionName, interval);
  }

  /**
   * Perform health check for a specific function
   */
  private async performHealthCheck(functionName: string, config: HealthCheckConfig): Promise<void> {
    const startTime = Date.now();
    let status: 'healthy' | 'degraded' | 'unhealthy' = 'healthy';
    let responseTime = 0;
    let success = false;

    try {
      const response = await fetch(config.endpoint, {
        method: 'GET',
        headers: { 'User-Agent': 'HealthMonitor/1.0' },
        signal: AbortSignal.timeout(config.timeout)
      });

      responseTime = Date.now() - startTime;
      success = response.ok;

      // Determine health status based on thresholds
      if (responseTime > config.thresholds.response_time) {
        status = 'degraded';
      }
      if (!success || responseTime > config.thresholds.response_time * 2) {
        status = 'unhealthy';
      }

    } catch (error) {
      responseTime = Date.now() - startTime;
      status = 'unhealthy';
      console.error(`Health check failed for ${functionName}:`, error);
    }

    // Update health status
    const currentHealth = this.healthStatus.get(functionName);
    if (currentHealth) {
      const metrics = this.metrics.get(functionName) || [];
      const recentMetrics = metrics.slice(-10); // Last 10 checks
      
      const errorRate = recentMetrics.length > 0 
        ? (recentMetrics.filter(m => m.error_count > 0).length / recentMetrics.length) * 100
        : 0;

      const successRate = recentMetrics.length > 0
        ? (recentMetrics.filter(m => m.error_count === 0).length / recentMetrics.length) * 100
        : 100;

      this.healthStatus.set(functionName, {
        ...currentHealth,
        status,
        response_time: responseTime,
        error_rate: errorRate,
        last_check: new Date(),
        success_rate: successRate
      });
    }

    // Record performance metrics
    this.recordMetrics(functionName, {
      timestamp: new Date(),
      function_name: functionName,
      invocation_count: 1,
      avg_response_time: responseTime,
      error_count: success ? 0 : 1,
      memory_peak: process.memoryUsage().heapUsed,
      cpu_peak: process.cpuUsage().user
    });
  }

  /**
   * Record performance metrics for a function
   */
  recordMetrics(functionName: string, metrics: PerformanceMetrics): void {
    const functionMetrics = this.metrics.get(functionName) || [];
    functionMetrics.push(metrics);

    // Keep only last 1000 metrics to prevent memory issues
    if (functionMetrics.length > 1000) {
      functionMetrics.splice(0, functionMetrics.length - 1000);
    }

    this.metrics.set(functionName, functionMetrics);
  }

  /**
   * Get current health status for a function
   */
  getHealthStatus(functionName: string): FunctionHealth | null {
    return this.healthStatus.get(functionName) || null;
  }

  /**
   * Get health status for all monitored functions
   */
  getAllHealthStatus(): FunctionHealth[] {
    return Array.from(this.healthStatus.values());
  }

  /**
   * Get performance metrics for a function
   */
  getMetrics(functionName: string, limit: number = 100): PerformanceMetrics[] {
    const metrics = this.metrics.get(functionName) || [];
    return metrics.slice(-limit);
  }

  /**
   * Get aggregated metrics for a function over a time period
   */
  getAggregatedMetrics(functionName: string, hours: number = 24): {
    avg_response_time: number;
    total_invocations: number;
    error_rate: number;
    success_rate: number;
  } {
    const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000);
    const metrics = this.metrics.get(functionName) || [];
    const recentMetrics = metrics.filter(m => m.timestamp >= cutoff);

    if (recentMetrics.length === 0) {
      return {
        avg_response_time: 0,
        total_invocations: 0,
        error_rate: 0,
        success_rate: 100
      };
    }

    const totalInvocations = recentMetrics.reduce((sum, m) => sum + m.invocation_count, 0);
    const totalErrors = recentMetrics.reduce((sum, m) => sum + m.error_count, 0);
    const avgResponseTime = recentMetrics.reduce((sum, m) => sum + m.avg_response_time, 0) / recentMetrics.length;

    return {
      avg_response_time: avgResponseTime,
      total_invocations: totalInvocations,
      error_rate: totalInvocations > 0 ? (totalErrors / totalInvocations) * 100 : 0,
      success_rate: totalInvocations > 0 ? ((totalInvocations - totalErrors) / totalInvocations) * 100 : 100
    };
  }

  /**
   * Stop monitoring a function
   */
  unregisterFunction(functionName: string): void {
    const interval = this.checkIntervals.get(functionName);
    if (interval) {
      clearInterval(interval);
      this.checkIntervals.delete(functionName);
    }
    
    this.healthStatus.delete(functionName);
    this.metrics.delete(functionName);
  }

  /**
   * Stop all monitoring
   */
  shutdown(): void {
    for (const interval of this.checkIntervals.values()) {
      clearInterval(interval);
    }
    this.checkIntervals.clear();
    this.healthStatus.clear();
    this.metrics.clear();
  }
}

// Singleton instance
export const healthMonitor = new HealthMonitor();

// Default configurations for different function types
export const defaultConfigs: Record<string, HealthCheckConfig> = {
  admin: {
    endpoint: '/api/admin/health',
    timeout: 5000,
    interval: 30000, // 30 seconds
    retries: 3,
    thresholds: {
      response_time: 2000, // 2 seconds
      error_rate: 5, // 5%
      memory_usage: 512 * 1024 * 1024 // 512MB
    }
  },
  public: {
    endpoint: '/api/public/health',
    timeout: 3000,
    interval: 15000, // 15 seconds
    retries: 3,
    thresholds: {
      response_time: 1000, // 1 second
      error_rate: 2, // 2%
      memory_usage: 256 * 1024 * 1024 // 256MB
    }
  },
  attempts: {
    endpoint: '/api/attempts/health',
    timeout: 5000,
    interval: 10000, // 10 seconds
    retries: 2,
    thresholds: {
      response_time: 3000, // 3 seconds
      error_rate: 3, // 3%
      memory_usage: 1024 * 1024 * 1024 // 1GB
    }
  }
};