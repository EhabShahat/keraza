/**
 * Traffic Router for Blue-Green Deployments
 * 
 * Manages traffic routing between blue and green environments
 * with gradual rollout and monitoring capabilities.
 */

export interface TrafficRule {
  id: string;
  environment: 'blue' | 'green';
  percentage: number;
  conditions?: RoutingCondition[];
  priority: number;
  active: boolean;
  created_at: Date;
  updated_at: Date;
}

export interface RoutingCondition {
  type: 'header' | 'query' | 'ip' | 'user_agent' | 'geo' | 'time';
  key: string;
  operator: 'equals' | 'contains' | 'starts_with' | 'ends_with' | 'regex' | 'in_range';
  value: string | string[] | number;
}

export interface TrafficMetrics {
  environment: 'blue' | 'green';
  requests_per_second: number;
  avg_response_time: number;
  error_rate: number;
  active_connections: number;
  timestamp: Date;
}

export interface RoutingDecision {
  environment: 'blue' | 'green';
  rule_id: string;
  reason: string;
  confidence: number;
}

export class TrafficRouter {
  private rules: Map<string, TrafficRule> = new Map();
  private metrics: Map<string, TrafficMetrics[]> = new Map();
  private defaultEnvironment: 'blue' | 'green' = 'blue';

  constructor() {
    this.initializeDefaultRules();
  }

  /**
   * Initialize default traffic routing rules
   */
  private initializeDefaultRules(): void {
    const defaultRule: TrafficRule = {
      id: 'default-blue',
      environment: 'blue',
      percentage: 100,
      priority: 1000, // Lowest priority
      active: true,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.rules.set(defaultRule.id, defaultRule);
  }

  /**
   * Route incoming request to appropriate environment
   */
  routeRequest(request: IncomingRequest): RoutingDecision {
    // Get all active rules sorted by priority
    const activeRules = Array.from(this.rules.values())
      .filter(rule => rule.active)
      .sort((a, b) => a.priority - b.priority);

    // Evaluate rules in priority order
    for (const rule of activeRules) {
      if (this.evaluateRule(rule, request)) {
        // Check if we should route based on percentage
        if (this.shouldRouteToEnvironment(rule)) {
          return {
            environment: rule.environment,
            rule_id: rule.id,
            reason: `Matched rule: ${rule.id}`,
            confidence: 1.0
          };
        }
      }
    }

    // Fallback to default environment
    return {
      environment: this.defaultEnvironment,
      rule_id: 'default',
      reason: 'No matching rules, using default environment',
      confidence: 0.5
    };
  }

  /**
   * Evaluate if a rule matches the request
   */
  private evaluateRule(rule: TrafficRule, request: IncomingRequest): boolean {
    if (!rule.conditions || rule.conditions.length === 0) {
      return true; // Rule with no conditions matches all requests
    }

    // All conditions must match (AND logic)
    return rule.conditions.every(condition => this.evaluateCondition(condition, request));
  }

  /**
   * Evaluate a single routing condition
   */
  private evaluateCondition(condition: RoutingCondition, request: IncomingRequest): boolean {
    let actualValue: string | undefined;

    switch (condition.type) {
      case 'header':
        actualValue = request.headers[condition.key.toLowerCase()];
        break;
      case 'query':
        actualValue = request.query[condition.key];
        break;
      case 'ip':
        actualValue = request.ip;
        break;
      case 'user_agent':
        actualValue = request.headers['user-agent'];
        break;
      case 'geo':
        actualValue = request.geo?.[condition.key];
        break;
      case 'time':
        actualValue = new Date().toISOString();
        break;
      default:
        return false;
    }

    if (!actualValue) {
      return false;
    }

    return this.evaluateOperator(condition.operator, actualValue, condition.value);
  }

  /**
   * Evaluate operator condition
   */
  private evaluateOperator(operator: string, actual: string, expected: string | string[] | number): boolean {
    switch (operator) {
      case 'equals':
        return actual === expected;
      case 'contains':
        return typeof expected === 'string' && actual.includes(expected);
      case 'starts_with':
        return typeof expected === 'string' && actual.startsWith(expected);
      case 'ends_with':
        return typeof expected === 'string' && actual.endsWith(expected);
      case 'regex':
        return typeof expected === 'string' && new RegExp(expected).test(actual);
      case 'in_range':
        if (Array.isArray(expected) && expected.length === 2) {
          const value = parseFloat(actual);
          return value >= expected[0] && value <= expected[1];
        }
        return false;
      default:
        return false;
    }
  }

  /**
   * Determine if request should be routed to environment based on percentage
   */
  private shouldRouteToEnvironment(rule: TrafficRule): boolean {
    if (rule.percentage >= 100) {
      return true;
    }

    // Use deterministic routing based on request hash for consistent user experience
    const hash = this.hashRequest();
    const threshold = (rule.percentage / 100) * 0xFFFFFFFF;
    
    return hash < threshold;
  }

  /**
   * Generate hash for consistent routing
   */
  private hashRequest(): number {
    // Simple hash function for demonstration
    // In production, this would use request ID or user ID for consistency
    return Math.floor(Math.random() * 0xFFFFFFFF);
  }

  /**
   * Add or update traffic routing rule
   */
  addRule(rule: Omit<TrafficRule, 'id' | 'created_at' | 'updated_at'>): string {
    const id = this.generateRuleId();
    const fullRule: TrafficRule = {
      ...rule,
      id,
      created_at: new Date(),
      updated_at: new Date()
    };

    this.rules.set(id, fullRule);
    return id;
  }

  /**
   * Update existing traffic rule
   */
  updateRule(id: string, updates: Partial<TrafficRule>): boolean {
    const rule = this.rules.get(id);
    if (!rule) {
      return false;
    }

    const updatedRule = {
      ...rule,
      ...updates,
      id, // Prevent ID changes
      updated_at: new Date()
    };

    this.rules.set(id, updatedRule);
    return true;
  }

  /**
   * Remove traffic rule
   */
  removeRule(id: string): boolean {
    return this.rules.delete(id);
  }

  /**
   * Set traffic percentage for environment
   */
  setTrafficPercentage(environment: 'blue' | 'green', percentage: number): void {
    // Remove existing percentage rules for this environment
    const toRemove = Array.from(this.rules.entries())
      .filter(([_, rule]) => rule.environment === environment && !rule.conditions)
      .map(([id, _]) => id);

    toRemove.forEach(id => this.rules.delete(id));

    // Add new percentage rule
    if (percentage > 0) {
      this.addRule({
        environment,
        percentage,
        priority: 500, // Medium priority
        active: true
      });
    }

    // Update opposite environment
    const oppositeEnv = environment === 'blue' ? 'green' : 'blue';
    const oppositePercentage = 100 - percentage;

    if (oppositePercentage > 0) {
      this.addRule({
        environment: oppositeEnv,
        percentage: oppositePercentage,
        priority: 501, // Slightly lower priority
        active: true
      });
    }
  }

  /**
   * Enable canary deployment for specific conditions
   */
  enableCanaryDeployment(
    environment: 'blue' | 'green',
    percentage: number,
    conditions: RoutingCondition[]
  ): string {
    return this.addRule({
      environment,
      percentage,
      conditions,
      priority: 100, // High priority for canary
      active: true
    });
  }

  /**
   * Gradually shift traffic between environments
   */
  async gradualTrafficShift(
    fromEnv: 'blue' | 'green',
    toEnv: 'blue' | 'green',
    steps: number[],
    intervalMs: number
  ): Promise<void> {
    console.log(`Starting gradual traffic shift from ${fromEnv} to ${toEnv}`);

    for (const percentage of steps) {
      console.log(`Shifting ${percentage}% traffic to ${toEnv}`);
      
      this.setTrafficPercentage(toEnv, percentage);
      
      // Wait for interval
      await this.sleep(intervalMs);
      
      // Monitor metrics during shift
      const metrics = await this.getEnvironmentMetrics(toEnv);
      if (this.shouldAbortShift(metrics)) {
        console.error('Aborting traffic shift due to performance issues');
        // Revert to previous state
        this.setTrafficPercentage(fromEnv, 100);
        throw new Error('Traffic shift aborted due to performance degradation');
      }
    }

    console.log(`Traffic shift completed. ${toEnv} now receiving 100% traffic`);
  }

  /**
   * Check if traffic shift should be aborted based on metrics
   */
  private shouldAbortShift(metrics: TrafficMetrics): boolean {
    return (
      metrics.error_rate > 0.05 || // 5% error rate threshold
      metrics.avg_response_time > 2000 // 2 second response time threshold
    );
  }

  /**
   * Record traffic metrics for environment
   */
  recordMetrics(environment: 'blue' | 'green', metrics: Omit<TrafficMetrics, 'environment' | 'timestamp'>): void {
    const fullMetrics: TrafficMetrics = {
      ...metrics,
      environment,
      timestamp: new Date()
    };

    if (!this.metrics.has(environment)) {
      this.metrics.set(environment, []);
    }

    const envMetrics = this.metrics.get(environment)!;
    envMetrics.push(fullMetrics);

    // Keep only last 100 metrics entries
    if (envMetrics.length > 100) {
      envMetrics.splice(0, envMetrics.length - 100);
    }
  }

  /**
   * Get recent metrics for environment
   */
  async getEnvironmentMetrics(environment: 'blue' | 'green'): Promise<TrafficMetrics> {
    const envMetrics = this.metrics.get(environment) || [];
    
    if (envMetrics.length === 0) {
      // Return default metrics if none recorded
      return {
        environment,
        requests_per_second: 0,
        avg_response_time: 0,
        error_rate: 0,
        active_connections: 0,
        timestamp: new Date()
      };
    }

    // Return most recent metrics
    return envMetrics[envMetrics.length - 1];
  }

  /**
   * Get traffic distribution summary
   */
  getTrafficDistribution(): { blue: number; green: number } {
    let bluePercentage = 0;
    let greenPercentage = 0;

    // Calculate effective traffic distribution
    const activeRules = Array.from(this.rules.values())
      .filter(rule => rule.active && !rule.conditions)
      .sort((a, b) => a.priority - b.priority);

    for (const rule of activeRules) {
      if (rule.environment === 'blue') {
        bluePercentage = Math.max(bluePercentage, rule.percentage);
      } else {
        greenPercentage = Math.max(greenPercentage, rule.percentage);
      }
    }

    // Normalize to 100%
    const total = bluePercentage + greenPercentage;
    if (total > 100) {
      bluePercentage = (bluePercentage / total) * 100;
      greenPercentage = (greenPercentage / total) * 100;
    }

    return { blue: bluePercentage, green: greenPercentage };
  }

  /**
   * Get all active rules
   */
  getActiveRules(): TrafficRule[] {
    return Array.from(this.rules.values())
      .filter(rule => rule.active)
      .sort((a, b) => a.priority - b.priority);
  }

  /**
   * Reset all rules to default
   */
  resetToDefault(): void {
    this.rules.clear();
    this.initializeDefaultRules();
  }

  private generateRuleId(): string {
    return `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Request interface for routing decisions
export interface IncomingRequest {
  method: string;
  url: string;
  headers: Record<string, string>;
  query: Record<string, string>;
  ip: string;
  geo?: Record<string, string>;
  user_id?: string;
}

// Singleton instance for global use
export const trafficRouter = new TrafficRouter();