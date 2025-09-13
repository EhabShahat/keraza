/**
 * Rollback and Safety Mechanisms
 * 
 * Implements automatic rollback triggers, manual rollback procedures,
 * and data consistency checks for safe deployments.
 */

export interface RollbackTrigger {
  id: string;
  name: string;
  type: 'automatic' | 'manual';
  condition: TriggerCondition;
  enabled: boolean;
  priority: number;
  cooldown_period: number; // seconds
  last_triggered?: Date;
}

export interface TriggerCondition {
  metric: 'error_rate' | 'response_time' | 'health_check_failures' | 'traffic_drop' | 'custom';
  threshold: number;
  duration: number; // seconds to observe before triggering
  operator: 'gt' | 'lt' | 'eq' | 'gte' | 'lte';
  aggregation?: 'avg' | 'max' | 'min' | 'sum' | 'count';
}

export interface RollbackProcedure {
  id: string;
  name: string;
  steps: RollbackStep[];
  validation_checks: ValidationCheck[];
  emergency_contacts: EmergencyContact[];
  estimated_duration: number; // seconds
}

export interface RollbackStep {
  id: string;
  order: number;
  name: string;
  type: 'traffic_revert' | 'function_restore' | 'data_restore' | 'cache_clear' | 'notification' | 'custom';
  parameters: Record<string, any>;
  timeout: number;
  retry_count: number;
  critical: boolean;
  rollback_on_failure: boolean;
}

export interface ValidationCheck {
  id: string;
  name: string;
  type: 'health_check' | 'data_integrity' | 'performance' | 'functional';
  endpoint?: string;
  query?: string;
  expected_result: any;
  timeout: number;
  critical: boolean;
}

export interface EmergencyContact {
  name: string;
  email: string;
  phone?: string;
  role: string;
  notification_methods: ('email' | 'sms' | 'slack' | 'webhook')[];
}

export interface RollbackExecution {
  id: string;
  trigger_id: string;
  procedure_id: string;
  start_time: Date;
  end_time?: Date;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  steps_completed: RollbackStepResult[];
  validation_results: ValidationResult[];
  error?: string;
  initiated_by: 'automatic' | 'manual';
  initiator?: string;
}

export interface RollbackStepResult {
  step_id: string;
  start_time: Date;
  end_time?: Date;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  attempts: number;
  error?: string;
  output?: any;
}

export interface ValidationResult {
  check_id: string;
  timestamp: Date;
  status: 'passed' | 'failed' | 'warning';
  result: any;
  error?: string;
}

export interface SafetyMetrics {
  error_rate: number;
  avg_response_time: number;
  health_check_failures: number;
  traffic_volume: number;
  active_connections: number;
  timestamp: Date;
}

export class RollbackSystem {
  private triggers: Map<string, RollbackTrigger> = new Map();
  private procedures: Map<string, RollbackProcedure> = new Map();
  private executions: RollbackExecution[] = [];
  private metricsHistory: SafetyMetrics[] = [];
  private monitoringInterval?: NodeJS.Timeout;

  constructor() {
    this.initializeDefaultTriggers();
    this.initializeDefaultProcedures();
  }

  /**
   * Initialize default rollback triggers
   */
  private initializeDefaultTriggers(): void {
    const defaultTriggers: RollbackTrigger[] = [
      {
        id: 'high-error-rate',
        name: 'High Error Rate',
        type: 'automatic',
        condition: {
          metric: 'error_rate',
          threshold: 0.05, // 5%
          duration: 120, // 2 minutes
          operator: 'gt',
          aggregation: 'avg'
        },
        enabled: true,
        priority: 1,
        cooldown_period: 300 // 5 minutes
      },
      {
        id: 'slow-response-time',
        name: 'Slow Response Time',
        type: 'automatic',
        condition: {
          metric: 'response_time',
          threshold: 2000, // 2 seconds
          duration: 180, // 3 minutes
          operator: 'gt',
          aggregation: 'avg'
        },
        enabled: true,
        priority: 2,
        cooldown_period: 300
      },
      {
        id: 'health-check-failures',
        name: 'Multiple Health Check Failures',
        type: 'automatic',
        condition: {
          metric: 'health_check_failures',
          threshold: 3,
          duration: 60, // 1 minute
          operator: 'gte',
          aggregation: 'count'
        },
        enabled: true,
        priority: 1,
        cooldown_period: 180 // 3 minutes
      },
      {
        id: 'traffic-drop',
        name: 'Significant Traffic Drop',
        type: 'automatic',
        condition: {
          metric: 'traffic_drop',
          threshold: 0.5, // 50% drop
          duration: 300, // 5 minutes
          operator: 'lt',
          aggregation: 'avg'
        },
        enabled: true,
        priority: 3,
        cooldown_period: 600 // 10 minutes
      }
    ];

    defaultTriggers.forEach(trigger => {
      this.triggers.set(trigger.id, trigger);
    });
  }

  /**
   * Initialize default rollback procedures
   */
  private initializeDefaultProcedures(): void {
    const emergencyContacts: EmergencyContact[] = [
      {
        name: 'DevOps Team',
        email: 'devops@company.com',
        role: 'Primary',
        notification_methods: ['email', 'slack']
      },
      {
        name: 'Engineering Manager',
        email: 'engineering-manager@company.com',
        role: 'Escalation',
        notification_methods: ['email', 'sms']
      }
    ];

    const standardProcedure: RollbackProcedure = {
      id: 'standard-rollback',
      name: 'Standard Rollback Procedure',
      steps: [
        {
          id: 'notify-start',
          order: 1,
          name: 'Notify Rollback Start',
          type: 'notification',
          parameters: {
            message: 'Rollback procedure initiated',
            severity: 'high'
          },
          timeout: 10000,
          retry_count: 2,
          critical: false,
          rollback_on_failure: false
        },
        {
          id: 'revert-traffic',
          order: 2,
          name: 'Revert Traffic to Blue Environment',
          type: 'traffic_revert',
          parameters: {
            target_environment: 'blue',
            percentage: 100,
            immediate: true
          },
          timeout: 30000,
          retry_count: 3,
          critical: true,
          rollback_on_failure: false
        },
        {
          id: 'clear-cache',
          order: 3,
          name: 'Clear Application Cache',
          type: 'cache_clear',
          parameters: {
            cache_types: ['memory', 'edge', 'database']
          },
          timeout: 15000,
          retry_count: 2,
          critical: false,
          rollback_on_failure: false
        },
        {
          id: 'validate-rollback',
          order: 4,
          name: 'Validate Rollback Success',
          type: 'custom',
          parameters: {
            validation_checks: ['health-check', 'performance-check']
          },
          timeout: 60000,
          retry_count: 1,
          critical: true,
          rollback_on_failure: false
        },
        {
          id: 'notify-completion',
          order: 5,
          name: 'Notify Rollback Completion',
          type: 'notification',
          parameters: {
            message: 'Rollback procedure completed successfully',
            severity: 'medium'
          },
          timeout: 10000,
          retry_count: 2,
          critical: false,
          rollback_on_failure: false
        }
      ],
      validation_checks: [
        {
          id: 'health-check',
          name: 'System Health Check',
          type: 'health_check',
          endpoint: '/api/admin/health',
          expected_result: { status: 'healthy' },
          timeout: 30000,
          critical: true
        },
        {
          id: 'performance-check',
          name: 'Performance Validation',
          type: 'performance',
          endpoint: '/api/public/health',
          expected_result: { response_time: { $lt: 1000 } },
          timeout: 15000,
          critical: false
        },
        {
          id: 'data-integrity',
          name: 'Data Integrity Check',
          type: 'data_integrity',
          query: 'SELECT COUNT(*) FROM exams WHERE status = "active"',
          expected_result: { $gt: 0 },
          timeout: 10000,
          critical: true
        }
      ],
      emergency_contacts: emergencyContacts,
      estimated_duration: 180 // 3 minutes
    };

    this.procedures.set(standardProcedure.id, standardProcedure);
  }

  /**
   * Start monitoring for rollback triggers
   */
  startMonitoring(): void {
    if (this.monitoringInterval) {
      this.stopMonitoring();
    }

    console.log('Starting rollback monitoring');
    
    this.monitoringInterval = setInterval(async () => {
      try {
        await this.checkTriggers();
      } catch (error) {
        console.error('Error checking rollback triggers:', error);
      }
    }, 30000); // Check every 30 seconds
  }

  /**
   * Stop monitoring for rollback triggers
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = undefined;
      console.log('Stopped rollback monitoring');
    }
  }

  /**
   * Check all enabled triggers
   */
  private async checkTriggers(): Promise<void> {
    const currentMetrics = await this.getCurrentMetrics();
    this.recordMetrics(currentMetrics);

    const enabledTriggers = Array.from(this.triggers.values())
      .filter(trigger => trigger.enabled)
      .sort((a, b) => a.priority - b.priority);

    for (const trigger of enabledTriggers) {
      if (this.shouldTriggerRollback(trigger, currentMetrics)) {
        await this.triggerRollback(trigger.id, 'automatic');
        break; // Only trigger one rollback at a time
      }
    }
  }

  /**
   * Check if a trigger condition is met
   */
  private shouldTriggerRollback(trigger: RollbackTrigger, currentMetrics: SafetyMetrics): boolean {
    // Check cooldown period
    if (trigger.last_triggered) {
      const timeSinceLastTrigger = (Date.now() - trigger.last_triggered.getTime()) / 1000;
      if (timeSinceLastTrigger < trigger.cooldown_period) {
        return false;
      }
    }

    // Get historical metrics for the duration period
    const durationMs = trigger.condition.duration * 1000;
    const cutoffTime = new Date(Date.now() - durationMs);
    const relevantMetrics = this.metricsHistory.filter(m => m.timestamp >= cutoffTime);

    if (relevantMetrics.length === 0) {
      return false;
    }

    // Calculate aggregated value
    const values = this.extractMetricValues(relevantMetrics, trigger.condition.metric);
    const aggregatedValue = this.aggregateValues(values, trigger.condition.aggregation || 'avg');

    // Check condition
    return this.evaluateCondition(aggregatedValue, trigger.condition.threshold, trigger.condition.operator);
  }

  /**
   * Extract metric values from metrics history
   */
  private extractMetricValues(metrics: SafetyMetrics[], metricType: string): number[] {
    return metrics.map(m => {
      switch (metricType) {
        case 'error_rate':
          return m.error_rate;
        case 'response_time':
          return m.avg_response_time;
        case 'health_check_failures':
          return m.health_check_failures;
        case 'traffic_drop':
          // Calculate traffic drop percentage compared to baseline
          const baseline = this.calculateTrafficBaseline();
          return baseline > 0 ? (baseline - m.traffic_volume) / baseline : 0;
        default:
          return 0;
      }
    });
  }

  /**
   * Aggregate values based on aggregation type
   */
  private aggregateValues(values: number[], aggregation: string): number {
    if (values.length === 0) return 0;

    switch (aggregation) {
      case 'avg':
        return values.reduce((sum, val) => sum + val, 0) / values.length;
      case 'max':
        return Math.max(...values);
      case 'min':
        return Math.min(...values);
      case 'sum':
        return values.reduce((sum, val) => sum + val, 0);
      case 'count':
        return values.length;
      default:
        return values[values.length - 1]; // Latest value
    }
  }

  /**
   * Evaluate condition based on operator
   */
  private evaluateCondition(value: number, threshold: number, operator: string): boolean {
    switch (operator) {
      case 'gt':
        return value > threshold;
      case 'gte':
        return value >= threshold;
      case 'lt':
        return value < threshold;
      case 'lte':
        return value <= threshold;
      case 'eq':
        return value === threshold;
      default:
        return false;
    }
  }

  /**
   * Calculate traffic baseline for comparison
   */
  private calculateTrafficBaseline(): number {
    // Use average traffic from last hour as baseline
    const oneHourAgo = new Date(Date.now() - 3600000);
    const baselineMetrics = this.metricsHistory.filter(m => m.timestamp >= oneHourAgo);
    
    if (baselineMetrics.length === 0) return 0;
    
    return baselineMetrics.reduce((sum, m) => sum + m.traffic_volume, 0) / baselineMetrics.length;
  }

  /**
   * Trigger rollback procedure
   */
  async triggerRollback(triggerId: string, initiatedBy: 'automatic' | 'manual', initiator?: string): Promise<string> {
    const trigger = this.triggers.get(triggerId);
    if (!trigger) {
      throw new Error(`Rollback trigger ${triggerId} not found`);
    }

    // Update trigger last triggered time
    trigger.last_triggered = new Date();

    // Use standard procedure for now (could be configurable per trigger)
    const procedure = this.procedures.get('standard-rollback');
    if (!procedure) {
      throw new Error('Standard rollback procedure not found');
    }

    const executionId = this.generateExecutionId();
    const execution: RollbackExecution = {
      id: executionId,
      trigger_id: triggerId,
      procedure_id: procedure.id,
      start_time: new Date(),
      status: 'in_progress',
      steps_completed: [],
      validation_results: [],
      initiated_by: initiatedBy,
      initiator
    };

    this.executions.push(execution);

    console.log(`Starting rollback execution ${executionId} triggered by ${triggerId}`);

    try {
      await this.executeProcedure(execution, procedure);
      
      execution.status = 'completed';
      execution.end_time = new Date();
      
      console.log(`Rollback execution ${executionId} completed successfully`);
      
    } catch (error) {
      execution.status = 'failed';
      execution.error = error.message;
      execution.end_time = new Date();
      
      console.error(`Rollback execution ${executionId} failed:`, error);
      
      // Send emergency notifications
      await this.sendEmergencyNotifications(procedure, execution, error);
    }

    return executionId;
  }

  /**
   * Execute rollback procedure
   */
  private async executeProcedure(execution: RollbackExecution, procedure: RollbackProcedure): Promise<void> {
    // Execute steps in order
    for (const step of procedure.steps.sort((a, b) => a.order - b.order)) {
      const stepResult: RollbackStepResult = {
        step_id: step.id,
        start_time: new Date(),
        status: 'running',
        attempts: 0
      };

      execution.steps_completed.push(stepResult);

      try {
        await this.executeStep(step, stepResult);
        
        stepResult.status = 'completed';
        stepResult.end_time = new Date();
        
      } catch (error) {
        stepResult.status = 'failed';
        stepResult.error = error.message;
        stepResult.end_time = new Date();
        
        if (step.critical) {
          throw new Error(`Critical step ${step.name} failed: ${error.message}`);
        } else {
          console.warn(`Non-critical step ${step.name} failed: ${error.message}`);
        }
      }
    }

    // Run validation checks
    for (const check of procedure.validation_checks) {
      const validationResult = await this.runValidationCheck(check);
      execution.validation_results.push(validationResult);
      
      if (check.critical && validationResult.status === 'failed') {
        throw new Error(`Critical validation check ${check.name} failed`);
      }
    }
  }

  /**
   * Execute a single rollback step
   */
  private async executeStep(step: RollbackStep, result: RollbackStepResult): Promise<void> {
    let lastError: Error | undefined;
    
    for (let attempt = 1; attempt <= step.retry_count + 1; attempt++) {
      result.attempts = attempt;
      
      try {
        console.log(`Executing step ${step.name} (attempt ${attempt})`);
        
        await this.executeStepAction(step);
        return; // Success
        
      } catch (error) {
        lastError = error as Error;
        
        if (attempt <= step.retry_count) {
          console.warn(`Step ${step.name} failed (attempt ${attempt}), retrying...`);
          await this.sleep(1000 * attempt); // Exponential backoff
        }
      }
    }
    
    throw lastError || new Error(`Step ${step.name} failed after ${step.retry_count + 1} attempts`);
  }

  /**
   * Execute step action based on type
   */
  private async executeStepAction(step: RollbackStep): Promise<void> {
    switch (step.type) {
      case 'traffic_revert':
        await this.revertTraffic(step.parameters);
        break;
      case 'function_restore':
        await this.restoreFunctions(step.parameters);
        break;
      case 'data_restore':
        await this.restoreData(step.parameters);
        break;
      case 'cache_clear':
        await this.clearCache(step.parameters);
        break;
      case 'notification':
        await this.sendNotification(step.parameters);
        break;
      case 'custom':
        await this.executeCustomAction(step.parameters);
        break;
      default:
        throw new Error(`Unknown step type: ${step.type}`);
    }
  }

  /**
   * Revert traffic routing
   */
  private async revertTraffic(parameters: any): Promise<void> {
    const { target_environment, percentage, immediate } = parameters;
    
    console.log(`Reverting traffic to ${target_environment} (${percentage}%)`);
    
    // This would integrate with the traffic router
    // For now, we'll simulate the action
    await this.sleep(2000);
  }

  /**
   * Restore functions to previous version
   */
  private async restoreFunctions(parameters: any): Promise<void> {
    const { version, functions } = parameters;
    
    console.log(`Restoring functions to version ${version}`);
    
    // This would restore function deployments
    await this.sleep(5000);
  }

  /**
   * Restore data if needed
   */
  private async restoreData(parameters: any): Promise<void> {
    const { backup_id, tables } = parameters;
    
    console.log(`Restoring data from backup ${backup_id}`);
    
    // This would restore data from backup
    await this.sleep(3000);
  }

  /**
   * Clear application cache
   */
  private async clearCache(parameters: any): Promise<void> {
    const { cache_types } = parameters;
    
    console.log(`Clearing cache types: ${cache_types.join(', ')}`);
    
    // This would clear the specified caches
    await this.sleep(1000);
  }

  /**
   * Send notification
   */
  private async sendNotification(parameters: any): Promise<void> {
    const { message, severity } = parameters;
    
    console.log(`Sending notification: ${message} (${severity})`);
    
    // This would send actual notifications
    await this.sleep(500);
  }

  /**
   * Execute custom action
   */
  private async executeCustomAction(parameters: any): Promise<void> {
    console.log('Executing custom rollback action');
    
    // This would execute custom rollback logic
    await this.sleep(2000);
  }

  /**
   * Run validation check
   */
  private async runValidationCheck(check: ValidationCheck): Promise<ValidationResult> {
    try {
      console.log(`Running validation check: ${check.name}`);
      
      let result: any;
      
      switch (check.type) {
        case 'health_check':
          result = await this.runHealthCheck(check);
          break;
        case 'data_integrity':
          result = await this.runDataIntegrityCheck(check);
          break;
        case 'performance':
          result = await this.runPerformanceCheck(check);
          break;
        case 'functional':
          result = await this.runFunctionalCheck(check);
          break;
        default:
          throw new Error(`Unknown validation check type: ${check.type}`);
      }
      
      const passed = this.validateResult(result, check.expected_result);
      
      return {
        check_id: check.id,
        timestamp: new Date(),
        status: passed ? 'passed' : 'failed',
        result
      };
      
    } catch (error) {
      return {
        check_id: check.id,
        timestamp: new Date(),
        status: 'failed',
        result: null,
        error: error.message
      };
    }
  }

  /**
   * Run health check validation
   */
  private async runHealthCheck(check: ValidationCheck): Promise<any> {
    if (!check.endpoint) {
      throw new Error('Health check requires endpoint');
    }
    
    const response = await fetch(check.endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(check.timeout)
    });
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
    }
    
    return await response.json();
  }

  /**
   * Run data integrity check
   */
  private async runDataIntegrityCheck(check: ValidationCheck): Promise<any> {
    if (!check.query) {
      throw new Error('Data integrity check requires query');
    }
    
    // This would execute the actual database query
    // For now, we'll simulate the result
    return { count: 42 };
  }

  /**
   * Run performance check
   */
  private async runPerformanceCheck(check: ValidationCheck): Promise<any> {
    if (!check.endpoint) {
      throw new Error('Performance check requires endpoint');
    }
    
    const startTime = Date.now();
    const response = await fetch(check.endpoint, {
      method: 'GET',
      signal: AbortSignal.timeout(check.timeout)
    });
    const responseTime = Date.now() - startTime;
    
    return {
      response_time: responseTime,
      status: response.status,
      ok: response.ok
    };
  }

  /**
   * Run functional check
   */
  private async runFunctionalCheck(check: ValidationCheck): Promise<any> {
    // This would run functional tests
    // For now, we'll simulate success
    return { functional_test: 'passed' };
  }

  /**
   * Validate result against expected result
   */
  private validateResult(actual: any, expected: any): boolean {
    // Simple validation logic - could be enhanced with more sophisticated matching
    if (typeof expected === 'object' && expected !== null) {
      for (const [key, value] of Object.entries(expected)) {
        if (key.startsWith('$')) {
          // Special operators
          switch (key) {
            case '$gt':
              return actual > value;
            case '$lt':
              return actual < value;
            case '$gte':
              return actual >= value;
            case '$lte':
              return actual <= value;
            default:
              return false;
          }
        } else {
          if (actual[key] !== value) {
            return false;
          }
        }
      }
      return true;
    }
    
    return actual === expected;
  }

  /**
   * Send emergency notifications
   */
  private async sendEmergencyNotifications(
    procedure: RollbackProcedure, 
    execution: RollbackExecution, 
    error: Error
  ): Promise<void> {
    console.log('Sending emergency notifications for failed rollback');
    
    for (const contact of procedure.emergency_contacts) {
      for (const method of contact.notification_methods) {
        try {
          await this.sendEmergencyNotification(contact, method, execution, error);
        } catch (notificationError) {
          console.error(`Failed to send ${method} notification to ${contact.name}:`, notificationError);
        }
      }
    }
  }

  /**
   * Send individual emergency notification
   */
  private async sendEmergencyNotification(
    contact: EmergencyContact,
    method: string,
    execution: RollbackExecution,
    error: Error
  ): Promise<void> {
    const message = `URGENT: Rollback execution ${execution.id} failed. Error: ${error.message}`;
    
    switch (method) {
      case 'email':
        console.log(`Sending email to ${contact.email}: ${message}`);
        break;
      case 'sms':
        console.log(`Sending SMS to ${contact.phone}: ${message}`);
        break;
      case 'slack':
        console.log(`Sending Slack message to ${contact.name}: ${message}`);
        break;
      case 'webhook':
        console.log(`Sending webhook notification: ${message}`);
        break;
    }
    
    // Simulate notification delay
    await this.sleep(100);
  }

  /**
   * Get current system metrics
   */
  private async getCurrentMetrics(): Promise<SafetyMetrics> {
    // This would collect real metrics from monitoring systems
    // For now, we'll simulate metrics
    return {
      error_rate: Math.random() * 0.1, // 0-10%
      avg_response_time: 100 + Math.random() * 200, // 100-300ms
      health_check_failures: Math.floor(Math.random() * 3), // 0-2 failures
      traffic_volume: 1000 + Math.random() * 500, // 1000-1500 requests
      active_connections: 50 + Math.random() * 100, // 50-150 connections
      timestamp: new Date()
    };
  }

  /**
   * Record metrics in history
   */
  private recordMetrics(metrics: SafetyMetrics): void {
    this.metricsHistory.push(metrics);
    
    // Keep only last 24 hours of metrics (assuming 30-second intervals)
    const maxEntries = 24 * 60 * 2; // 2880 entries
    if (this.metricsHistory.length > maxEntries) {
      this.metricsHistory.splice(0, this.metricsHistory.length - maxEntries);
    }
  }

  /**
   * Manual rollback trigger
   */
  async manualRollback(reason: string, initiator: string): Promise<string> {
    console.log(`Manual rollback triggered by ${initiator}: ${reason}`);
    
    // Create a manual trigger
    const manualTriggerId = `manual-${Date.now()}`;
    const manualTrigger: RollbackTrigger = {
      id: manualTriggerId,
      name: 'Manual Rollback',
      type: 'manual',
      condition: {
        metric: 'custom',
        threshold: 0,
        duration: 0,
        operator: 'eq'
      },
      enabled: true,
      priority: 0, // Highest priority
      cooldown_period: 0
    };
    
    this.triggers.set(manualTriggerId, manualTrigger);
    
    try {
      return await this.triggerRollback(manualTriggerId, 'manual', initiator);
    } finally {
      // Clean up manual trigger
      this.triggers.delete(manualTriggerId);
    }
  }

  /**
   * Get rollback execution history
   */
  getRollbackHistory(): RollbackExecution[] {
    return [...this.executions].sort((a, b) => b.start_time.getTime() - a.start_time.getTime());
  }

  /**
   * Get current rollback status
   */
  getCurrentStatus(): {
    monitoring_active: boolean;
    active_executions: RollbackExecution[];
    recent_executions: RollbackExecution[];
    enabled_triggers: RollbackTrigger[];
  } {
    const activeExecutions = this.executions.filter(e => e.status === 'in_progress');
    const recentExecutions = this.executions
      .filter(e => e.start_time > new Date(Date.now() - 24 * 60 * 60 * 1000)) // Last 24 hours
      .sort((a, b) => b.start_time.getTime() - a.start_time.getTime())
      .slice(0, 10);
    
    const enabledTriggers = Array.from(this.triggers.values()).filter(t => t.enabled);
    
    return {
      monitoring_active: !!this.monitoringInterval,
      active_executions: activeExecutions,
      recent_executions: recentExecutions,
      enabled_triggers: enabledTriggers
    };
  }

  private generateExecutionId(): string {
    return `rollback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for global use
 */
export const rollbackSystem = new RollbackSystem();