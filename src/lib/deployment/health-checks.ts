/**
 * Health Check System for Blue-Green Deployments
 * 
 * Comprehensive health monitoring for deployment validation
 * with configurable checks and automated recovery.
 */

export interface HealthCheck {
  id: string;
  name: string;
  type: 'http' | 'database' | 'cache' | 'external_service' | 'custom';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  body?: any;
  timeout: number;
  interval: number;
  retries: number;
  expected_status?: number;
  expected_response?: any;
  critical: boolean;
  enabled: boolean;
  tags: string[];
}

export interface HealthCheckResult {
  check_id: string;
  timestamp: Date;
  status: 'healthy' | 'unhealthy' | 'warning' | 'unknown';
  response_time: number;
  error?: string;
  details?: any;
  attempt: number;
}

export interface HealthSummary {
  environment: 'blue' | 'green';
  overall_status: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
  total_checks: number;
  healthy_checks: number;
  unhealthy_checks: number;
  warning_checks: number;
  critical_failures: number;
  last_updated: Date;
  checks: HealthCheckResult[];
}

export interface DeploymentHealthConfig {
  pre_deployment_checks: string[];
  post_deployment_checks: string[];
  continuous_checks: string[];
  failure_thresholds: {
    critical_failures: number;
    total_failure_rate: number;
    response_time_threshold: number;
  };
  recovery_actions: RecoveryAction[];
}

export interface RecoveryAction {
  trigger: 'critical_failure' | 'high_error_rate' | 'slow_response' | 'multiple_failures';
  action: 'rollback' | 'restart' | 'scale' | 'notify' | 'custom';
  parameters: Record<string, any>;
  delay: number;
}

export class DeploymentHealthChecker {
  private checks: Map<string, HealthCheck> = new Map();
  private results: Map<string, HealthCheckResult[]> = new Map();
  private intervals: Map<string, NodeJS.Timeout> = new Map();
  private config: DeploymentHealthConfig;

  constructor(config: DeploymentHealthConfig) {
    this.config = config;
    this.initializeDefaultChecks();
  }

  /**
   * Initialize default health checks for the application
   */
  private initializeDefaultChecks(): void {
    const defaultChecks: HealthCheck[] = [
      {
        id: 'admin-api-health',
        name: 'Admin API Health',
        type: 'http',
        endpoint: '/api/admin/health',
        method: 'GET',
        timeout: 10000,
        interval: 30000,
        retries: 3,
        expected_status: 200,
        critical: true,
        enabled: true,
        tags: ['api', 'admin', 'critical']
      },
      {
        id: 'public-api-health',
        name: 'Public API Health',
        type: 'http',
        endpoint: '/api/public/health',
        method: 'GET',
        timeout: 10000,
        interval: 30000,
        retries: 3,
        expected_status: 200,
        critical: true,
        enabled: true,
        tags: ['api', 'public', 'critical']
      },
      {
        id: 'attempts-api-health',
        name: 'Attempts API Health',
        type: 'http',
        endpoint: '/api/attempts/health',
        method: 'GET',
        timeout: 10000,
        interval: 30000,
        retries: 3,
        expected_status: 200,
        critical: true,
        enabled: true,
        tags: ['api', 'attempts', 'critical']
      },
      {
        id: 'database-connection',
        name: 'Database Connection',
        type: 'database',
        timeout: 5000,
        interval: 60000,
        retries: 2,
        critical: true,
        enabled: true,
        tags: ['database', 'critical']
      },
      {
        id: 'cache-health',
        name: 'Cache System Health',
        type: 'cache',
        timeout: 3000,
        interval: 45000,
        retries: 2,
        critical: false,
        enabled: true,
        tags: ['cache', 'performance']
      }
    ];

    defaultChecks.forEach(check => {
      this.checks.set(check.id, check);
    });
  }

  /**
   * Add a new health check
   */
  addHealthCheck(check: HealthCheck): void {
    this.checks.set(check.id, check);
    
    if (check.enabled) {
      this.startContinuousCheck(check.id);
    }
  }

  /**
   * Remove a health check
   */
  removeHealthCheck(checkId: string): boolean {
    this.stopContinuousCheck(checkId);
    this.results.delete(checkId);
    return this.checks.delete(checkId);
  }

  /**
   * Run pre-deployment health checks
   */
  async runPreDeploymentChecks(): Promise<HealthSummary> {
    console.log('Running pre-deployment health checks');
    
    const checkIds = this.config.pre_deployment_checks.length > 0 
      ? this.config.pre_deployment_checks 
      : Array.from(this.checks.keys());

    return await this.runHealthChecks(checkIds, 'pre-deployment');
  }

  /**
   * Run post-deployment health checks
   */
  async runPostDeploymentChecks(): Promise<HealthSummary> {
    console.log('Running post-deployment health checks');
    
    const checkIds = this.config.post_deployment_checks.length > 0 
      ? this.config.post_deployment_checks 
      : Array.from(this.checks.keys());

    return await this.runHealthChecks(checkIds, 'post-deployment');
  }

  /**
   * Start continuous health monitoring
   */
  startContinuousMonitoring(): void {
    console.log('Starting continuous health monitoring');
    
    const checkIds = this.config.continuous_checks.length > 0 
      ? this.config.continuous_checks 
      : Array.from(this.checks.keys()).filter(id => this.checks.get(id)?.enabled);

    checkIds.forEach(checkId => {
      this.startContinuousCheck(checkId);
    });
  }

  /**
   * Stop continuous health monitoring
   */
  stopContinuousMonitoring(): void {
    console.log('Stopping continuous health monitoring');
    
    this.intervals.forEach((interval, checkId) => {
      this.stopContinuousCheck(checkId);
    });
  }

  /**
   * Start continuous check for specific health check
   */
  private startContinuousCheck(checkId: string): void {
    const check = this.checks.get(checkId);
    if (!check || !check.enabled) {
      return;
    }

    // Stop existing interval if any
    this.stopContinuousCheck(checkId);

    // Start new interval
    const interval = setInterval(async () => {
      try {
        await this.runSingleHealthCheck(checkId);
      } catch (error) {
        console.error(`Continuous health check ${checkId} failed:`, error);
      }
    }, check.interval);

    this.intervals.set(checkId, interval);

    // Run initial check
    this.runSingleHealthCheck(checkId).catch(error => {
      console.error(`Initial health check ${checkId} failed:`, error);
    });
  }

  /**
   * Stop continuous check for specific health check
   */
  private stopContinuousCheck(checkId: string): void {
    const interval = this.intervals.get(checkId);
    if (interval) {
      clearInterval(interval);
      this.intervals.delete(checkId);
    }
  }

  /**
   * Run multiple health checks
   */
  private async runHealthChecks(checkIds: string[], context: string): Promise<HealthSummary> {
    const results: HealthCheckResult[] = [];
    
    // Run checks in parallel
    const promises = checkIds.map(async (checkId) => {
      try {
        const result = await this.runSingleHealthCheck(checkId);
        results.push(result);
        return result;
      } catch (error) {
        const errorResult: HealthCheckResult = {
          check_id: checkId,
          timestamp: new Date(),
          status: 'unhealthy',
          response_time: 0,
          error: error.message,
          attempt: 1
        };
        results.push(errorResult);
        return errorResult;
      }
    });

    await Promise.all(promises);

    // Calculate summary
    const summary = this.calculateHealthSummary(results, context);
    
    // Check if recovery actions should be triggered
    await this.evaluateRecoveryActions(summary);

    return summary;
  }

  /**
   * Run a single health check with retries
   */
  async runSingleHealthCheck(checkId: string): Promise<HealthCheckResult> {
    const check = this.checks.get(checkId);
    if (!check) {
      throw new Error(`Health check ${checkId} not found`);
    }

    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= check.retries + 1; attempt++) {
      try {
        const startTime = Date.now();
        const result = await this.executeHealthCheck(check);
        const responseTime = Date.now() - startTime;

        const healthResult: HealthCheckResult = {
          check_id: checkId,
          timestamp: new Date(),
          status: result.healthy ? 'healthy' : 'unhealthy',
          response_time: responseTime,
          details: result.details,
          attempt
        };

        if (result.healthy) {
          this.recordResult(checkId, healthResult);
          return healthResult;
        } else {
          lastError = new Error(result.error || 'Health check failed');
        }

      } catch (error) {
        lastError = error as Error;
        
        if (attempt <= check.retries) {
          console.warn(`Health check ${checkId} failed (attempt ${attempt}), retrying...`);
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }

    // All attempts failed
    const failedResult: HealthCheckResult = {
      check_id: checkId,
      timestamp: new Date(),
      status: 'unhealthy',
      response_time: 0,
      error: lastError?.message || 'Unknown error',
      attempt: check.retries + 1
    };

    this.recordResult(checkId, failedResult);
    return failedResult;
  }

  /**
   * Execute specific type of health check
   */
  private async executeHealthCheck(check: HealthCheck): Promise<{ healthy: boolean; error?: string; details?: any }> {
    switch (check.type) {
      case 'http':
        return await this.executeHttpCheck(check);
      case 'database':
        return await this.executeDatabaseCheck(check);
      case 'cache':
        return await this.executeCacheCheck(check);
      case 'external_service':
        return await this.executeExternalServiceCheck(check);
      case 'custom':
        return await this.executeCustomCheck(check);
      default:
        throw new Error(`Unknown health check type: ${check.type}`);
    }
  }

  /**
   * Execute HTTP health check
   */
  private async executeHttpCheck(check: HealthCheck): Promise<{ healthy: boolean; error?: string; details?: any }> {
    if (!check.endpoint) {
      throw new Error('HTTP health check requires endpoint');
    }

    try {
      const response = await fetch(check.endpoint, {
        method: check.method || 'GET',
        headers: check.headers,
        body: check.body ? JSON.stringify(check.body) : undefined,
        signal: AbortSignal.timeout(check.timeout)
      });

      const healthy = check.expected_status ? response.status === check.expected_status : response.ok;
      
      let details: any = {
        status: response.status,
        statusText: response.statusText
      };

      if (check.expected_response) {
        try {
          const responseData = await response.json();
          details.response = responseData;
          
          if (JSON.stringify(responseData) !== JSON.stringify(check.expected_response)) {
            return {
              healthy: false,
              error: 'Response does not match expected response',
              details
            };
          }
        } catch (error) {
          return {
            healthy: false,
            error: 'Failed to parse response as JSON',
            details
          };
        }
      }

      return {
        healthy,
        error: healthy ? undefined : `HTTP ${response.status}: ${response.statusText}`,
        details
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        details: { error: error.message }
      };
    }
  }

  /**
   * Execute database health check
   */
  private async executeDatabaseCheck(check: HealthCheck): Promise<{ healthy: boolean; error?: string; details?: any }> {
    try {
      // This would use the actual database client
      // For now, we'll simulate the check
      const connectionTime = Math.random() * 100;
      
      if (connectionTime > 50) {
        return {
          healthy: false,
          error: 'Database connection timeout',
          details: { connection_time: connectionTime }
        };
      }

      return {
        healthy: true,
        details: { connection_time: connectionTime }
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        details: { error: error.message }
      };
    }
  }

  /**
   * Execute cache health check
   */
  private async executeCacheCheck(check: HealthCheck): Promise<{ healthy: boolean; error?: string; details?: any }> {
    try {
      // This would use the actual cache client
      // For now, we'll simulate the check
      const cacheLatency = Math.random() * 10;
      
      return {
        healthy: true,
        details: { latency: cacheLatency }
      };

    } catch (error) {
      return {
        healthy: false,
        error: error.message,
        details: { error: error.message }
      };
    }
  }

  /**
   * Execute external service health check
   */
  private async executeExternalServiceCheck(check: HealthCheck): Promise<{ healthy: boolean; error?: string; details?: any }> {
    // Similar to HTTP check but for external services
    return await this.executeHttpCheck(check);
  }

  /**
   * Execute custom health check
   */
  private async executeCustomCheck(check: HealthCheck): Promise<{ healthy: boolean; error?: string; details?: any }> {
    // This would execute custom health check logic
    // For now, we'll return a default healthy status
    return {
      healthy: true,
      details: { custom_check: true }
    };
  }

  /**
   * Record health check result
   */
  private recordResult(checkId: string, result: HealthCheckResult): void {
    if (!this.results.has(checkId)) {
      this.results.set(checkId, []);
    }

    const results = this.results.get(checkId)!;
    results.push(result);

    // Keep only last 50 results per check
    if (results.length > 50) {
      results.splice(0, results.length - 50);
    }
  }

  /**
   * Calculate health summary from results
   */
  private calculateHealthSummary(results: HealthCheckResult[], context: string): HealthSummary {
    const totalChecks = results.length;
    const healthyChecks = results.filter(r => r.status === 'healthy').length;
    const unhealthyChecks = results.filter(r => r.status === 'unhealthy').length;
    const warningChecks = results.filter(r => r.status === 'warning').length;
    
    // Count critical failures
    const criticalFailures = results.filter(r => {
      const check = this.checks.get(r.check_id);
      return check?.critical && r.status === 'unhealthy';
    }).length;

    // Determine overall status
    let overallStatus: 'healthy' | 'unhealthy' | 'degraded' | 'unknown';
    
    if (criticalFailures > 0) {
      overallStatus = 'unhealthy';
    } else if (unhealthyChecks > 0 || warningChecks > 0) {
      overallStatus = 'degraded';
    } else if (healthyChecks === totalChecks) {
      overallStatus = 'healthy';
    } else {
      overallStatus = 'unknown';
    }

    return {
      environment: 'blue', // This would be determined by context
      overall_status: overallStatus,
      total_checks: totalChecks,
      healthy_checks: healthyChecks,
      unhealthy_checks: unhealthyChecks,
      warning_checks: warningChecks,
      critical_failures: criticalFailures,
      last_updated: new Date(),
      checks: results
    };
  }

  /**
   * Evaluate if recovery actions should be triggered
   */
  private async evaluateRecoveryActions(summary: HealthSummary): Promise<void> {
    const thresholds = this.config.failure_thresholds;
    
    // Check critical failures
    if (summary.critical_failures >= thresholds.critical_failures) {
      await this.triggerRecoveryAction('critical_failure', summary);
    }

    // Check total failure rate
    const failureRate = summary.unhealthy_checks / summary.total_checks;
    if (failureRate >= thresholds.total_failure_rate) {
      await this.triggerRecoveryAction('high_error_rate', summary);
    }

    // Check response times
    const slowChecks = summary.checks.filter(c => c.response_time > thresholds.response_time_threshold);
    if (slowChecks.length > 0) {
      await this.triggerRecoveryAction('slow_response', summary);
    }
  }

  /**
   * Trigger recovery action
   */
  private async triggerRecoveryAction(trigger: string, summary: HealthSummary): Promise<void> {
    const actions = this.config.recovery_actions.filter(a => a.trigger === trigger);
    
    for (const action of actions) {
      try {
        console.log(`Triggering recovery action: ${action.action} for ${trigger}`);
        
        if (action.delay > 0) {
          await this.sleep(action.delay);
        }

        await this.executeRecoveryAction(action, summary);
        
      } catch (error) {
        console.error(`Recovery action ${action.action} failed:`, error);
      }
    }
  }

  /**
   * Execute recovery action
   */
  private async executeRecoveryAction(action: RecoveryAction, summary: HealthSummary): Promise<void> {
    switch (action.action) {
      case 'rollback':
        console.log('Triggering rollback due to health check failures');
        // This would trigger the actual rollback process
        break;
      case 'restart':
        console.log('Restarting services due to health check failures');
        // This would restart the affected services
        break;
      case 'scale':
        console.log('Scaling services due to health check failures');
        // This would scale up the services
        break;
      case 'notify':
        console.log('Sending notifications due to health check failures');
        // This would send notifications to the team
        break;
      case 'custom':
        console.log('Executing custom recovery action');
        // This would execute custom recovery logic
        break;
    }
  }

  /**
   * Get health check results for a specific check
   */
  getCheckResults(checkId: string): HealthCheckResult[] {
    return this.results.get(checkId) || [];
  }

  /**
   * Get current health status for all checks
   */
  getCurrentHealthStatus(): HealthSummary {
    const allResults: HealthCheckResult[] = [];
    
    this.results.forEach((results, checkId) => {
      if (results.length > 0) {
        allResults.push(results[results.length - 1]); // Get latest result
      }
    });

    return this.calculateHealthSummary(allResults, 'current');
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Default deployment health configuration
 */
export const defaultDeploymentHealthConfig: DeploymentHealthConfig = {
  pre_deployment_checks: ['admin-api-health', 'public-api-health', 'database-connection'],
  post_deployment_checks: ['admin-api-health', 'public-api-health', 'attempts-api-health', 'database-connection'],
  continuous_checks: ['admin-api-health', 'public-api-health', 'attempts-api-health', 'database-connection', 'cache-health'],
  failure_thresholds: {
    critical_failures: 1,
    total_failure_rate: 0.3,
    response_time_threshold: 5000
  },
  recovery_actions: [
    {
      trigger: 'critical_failure',
      action: 'rollback',
      parameters: { immediate: true },
      delay: 0
    },
    {
      trigger: 'high_error_rate',
      action: 'notify',
      parameters: { severity: 'high' },
      delay: 30000
    }
  ]
};