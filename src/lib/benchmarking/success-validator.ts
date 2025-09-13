/**
 * Success Metrics Validation System
 * Validates optimization success against defined criteria and requirements
 */

import { BenchmarkMetrics, BenchmarkComparison } from './performance-benchmarker';
import { CostBreakdown, ROIAnalysis } from './cost-analyzer';

export interface SuccessCriteria {
  id: string;
  name: string;
  description: string;
  category: 'performance' | 'cost' | 'reliability' | 'scalability' | 'feature_parity';
  metric: string;
  target: number;
  operator: 'greater_than' | 'less_than' | 'equals' | 'greater_equal' | 'less_equal' | 'percentage_improvement';
  priority: 'critical' | 'high' | 'medium' | 'low';
  requirementId?: string; // Reference to original requirement
}

export interface ValidationResult {
  criteriaId: string;
  name: string;
  passed: boolean;
  actualValue: number;
  targetValue: number;
  deviation: number; // Percentage deviation from target
  message: string;
  priority: 'critical' | 'high' | 'medium' | 'low';
  category: string;
}

export interface SuccessReport {
  timestamp: Date;
  overallSuccess: boolean;
  successRate: number; // Percentage of criteria passed
  criticalFailures: number;
  highFailures: number;
  mediumFailures: number;
  lowFailures: number;
  results: ValidationResult[];
  summary: {
    performance: { passed: number; total: number };
    cost: { passed: number; total: number };
    reliability: { passed: number; total: number };
    scalability: { passed: number; total: number };
    feature_parity: { passed: number; total: number };
  };
  recommendations: string[];
}

export interface FeatureParityTest {
  id: string;
  name: string;
  endpoint: string;
  method: string;
  payload?: any;
  expectedResponse: any;
  timeout: number;
}

export interface FeatureParityResult {
  testId: string;
  name: string;
  passed: boolean;
  actualResponse: any;
  expectedResponse: any;
  responseTime: number;
  error?: string;
}

export class SuccessValidator {
  private successCriteria: SuccessCriteria[] = [
    // Performance Criteria (from Requirements 10.1, 10.2, 10.3)
    {
      id: 'response-time-improvement',
      name: 'Response Time Improvement',
      description: 'Response time should improve by at least 25%',
      category: 'performance',
      metric: 'responseTime',
      target: 25,
      operator: 'percentage_improvement',
      priority: 'high',
      requirementId: '10.2'
    },
    {
      id: 'throughput-improvement',
      name: 'Throughput Improvement',
      description: 'Throughput should improve by at least 20%',
      category: 'performance',
      metric: 'throughput',
      target: 20,
      operator: 'percentage_improvement',
      priority: 'high',
      requirementId: '10.2'
    },
    {
      id: 'error-rate-maintenance',
      name: 'Error Rate Maintenance',
      description: 'Error rate should not exceed 1%',
      category: 'reliability',
      metric: 'errorRate',
      target: 1,
      operator: 'less_equal',
      priority: 'critical',
      requirementId: '10.3'
    },
    {
      id: 'function-count-reduction',
      name: 'Function Count Reduction',
      description: 'Function count should be reduced by at least 40%',
      category: 'scalability',
      metric: 'functionCount',
      target: 40,
      operator: 'percentage_improvement',
      priority: 'critical',
      requirementId: '2.6'
    },
    {
      id: 'cache-hit-rate',
      name: 'Cache Hit Rate',
      description: 'Cache hit rate should be at least 80%',
      category: 'performance',
      metric: 'cacheHitRate',
      target: 80,
      operator: 'greater_equal',
      priority: 'medium',
      requirementId: '3.6'
    },
    {
      id: 'database-query-improvement',
      name: 'Database Query Time Improvement',
      description: 'Database query time should improve by at least 25%',
      category: 'performance',
      metric: 'databaseQueryTime',
      target: 25,
      operator: 'percentage_improvement',
      priority: 'medium',
      requirementId: '5.6'
    },
    // Cost Criteria (from Requirements 10.4, 10.5, 10.6)
    {
      id: 'cost-reduction',
      name: 'Cost Reduction',
      description: 'Total costs should be reduced by at least 30%',
      category: 'cost',
      metric: 'totalCost',
      target: 30,
      operator: 'percentage_improvement',
      priority: 'high',
      requirementId: '10.4'
    },
    {
      id: 'roi-target',
      name: 'ROI Target',
      description: 'ROI should be at least 200%',
      category: 'cost',
      metric: 'roi',
      target: 200,
      operator: 'greater_equal',
      priority: 'medium',
      requirementId: '10.5'
    }
  ];

  private featureParityTests: FeatureParityTest[] = [
    // Admin API Feature Parity Tests
    {
      id: 'admin-login',
      name: 'Admin Login',
      endpoint: '/api/admin/auth/login',
      method: 'POST',
      payload: { username: 'test', password: 'test' },
      expectedResponse: { success: true },
      timeout: 5000
    },
    {
      id: 'admin-exams-list',
      name: 'Admin Exams List',
      endpoint: '/api/admin/exams',
      method: 'GET',
      expectedResponse: { exams: [] },
      timeout: 5000
    },
    {
      id: 'admin-monitoring',
      name: 'Admin Monitoring',
      endpoint: '/api/admin/monitoring/status',
      method: 'GET',
      expectedResponse: { status: 'healthy' },
      timeout: 5000
    },
    // Public API Feature Parity Tests
    {
      id: 'public-system-status',
      name: 'Public System Status',
      endpoint: '/api/public/system-status',
      method: 'GET',
      expectedResponse: { mode: 'exam' },
      timeout: 3000
    },
    {
      id: 'public-health',
      name: 'Public Health Check',
      endpoint: '/api/public/health',
      method: 'GET',
      expectedResponse: { status: 'ok' },
      timeout: 3000
    },
    // Attempt API Feature Parity Tests
    {
      id: 'attempts-health',
      name: 'Attempts Health Check',
      endpoint: '/api/attempts/health',
      method: 'GET',
      expectedResponse: { status: 'ok' },
      timeout: 3000
    }
  ];

  /**
   * Validate all success criteria
   */
  async validateSuccess(
    performanceComparison?: BenchmarkComparison,
    costComparison?: { baseline: CostBreakdown; current: CostBreakdown },
    roiAnalysis?: ROIAnalysis
  ): Promise<SuccessReport> {
    console.log('🔍 Validating optimization success criteria...');

    const results: ValidationResult[] = [];
    const timestamp = new Date();

    // Validate performance criteria
    if (performanceComparison) {
      const performanceResults = this.validatePerformanceCriteria(performanceComparison);
      results.push(...performanceResults);
    }

    // Validate cost criteria
    if (costComparison) {
      const costResults = this.validateCostCriteria(costComparison);
      results.push(...costResults);
    }

    // Validate ROI criteria
    if (roiAnalysis) {
      const roiResults = this.validateROICriteria(roiAnalysis);
      results.push(...roiResults);
    }

    // Run feature parity tests
    const featureParityResults = await this.validateFeatureParity();
    const featureParityValidation = this.convertFeatureParityToValidation(featureParityResults);
    results.push(...featureParityValidation);

    // Calculate summary statistics
    const summary = this.calculateSummary(results);
    const overallSuccess = this.determineOverallSuccess(results);
    const successRate = (results.filter(r => r.passed).length / results.length) * 100;

    const criticalFailures = results.filter(r => !r.passed && r.priority === 'critical').length;
    const highFailures = results.filter(r => !r.passed && r.priority === 'high').length;
    const mediumFailures = results.filter(r => !r.passed && r.priority === 'medium').length;
    const lowFailures = results.filter(r => !r.passed && r.priority === 'low').length;

    const recommendations = this.generateRecommendations(results);

    const report: SuccessReport = {
      timestamp,
      overallSuccess,
      successRate,
      criticalFailures,
      highFailures,
      mediumFailures,
      lowFailures,
      results,
      summary,
      recommendations
    };

    console.log(`✅ Success validation completed: ${overallSuccess ? 'PASSED' : 'FAILED'} (${successRate.toFixed(1)}% success rate)`);

    return report;
  }

  /**
   * Validate performance criteria
   */
  private validatePerformanceCriteria(comparison: BenchmarkComparison): ValidationResult[] {
    const results: ValidationResult[] = [];
    const performanceCriteria = this.successCriteria.filter(c => c.category === 'performance' || c.category === 'reliability');

    for (const criteria of performanceCriteria) {
      const result = this.validateSingleCriteria(criteria, comparison.baseline, comparison.current, comparison.improvements);
      results.push(result);
    }

    return results;
  }

  /**
   * Validate cost criteria
   */
  private validateCostCriteria(costComparison: { baseline: CostBreakdown; current: CostBreakdown }): ValidationResult[] {
    const results: ValidationResult[] = [];
    const costCriteria = this.successCriteria.filter(c => c.category === 'cost');

    // Calculate cost improvements
    const costImprovements = {
      totalCost: ((costComparison.baseline.totalCost - costComparison.current.totalCost) / costComparison.baseline.totalCost) * 100,
      functionCosts: ((costComparison.baseline.functionCosts - costComparison.current.functionCosts) / costComparison.baseline.functionCosts) * 100,
      computeCosts: ((costComparison.baseline.computeCosts - costComparison.current.computeCosts) / costComparison.baseline.computeCosts) * 100
    };

    for (const criteria of costCriteria) {
      if (criteria.metric === 'totalCost') {
        const result = this.validateSingleCriteria(criteria, costComparison.baseline, costComparison.current, costImprovements);
        results.push(result);
      }
    }

    return results;
  }

  /**
   * Validate ROI criteria
   */
  private validateROICriteria(roiAnalysis: ROIAnalysis): ValidationResult[] {
    const results: ValidationResult[] = [];
    const roiCriteria = this.successCriteria.filter(c => c.metric === 'roi');

    for (const criteria of roiCriteria) {
      const passed = this.evaluateCondition(roiAnalysis.roi, criteria.target, criteria.operator);
      const deviation = ((roiAnalysis.roi - criteria.target) / criteria.target) * 100;

      results.push({
        criteriaId: criteria.id,
        name: criteria.name,
        passed,
        actualValue: roiAnalysis.roi,
        targetValue: criteria.target,
        deviation,
        message: passed 
          ? `ROI of ${roiAnalysis.roi.toFixed(1)}% meets target of ${criteria.target}%`
          : `ROI of ${roiAnalysis.roi.toFixed(1)}% does not meet target of ${criteria.target}%`,
        priority: criteria.priority,
        category: criteria.category
      });
    }

    return results;
  }

  /**
   * Validate feature parity
   */
  async validateFeatureParity(): Promise<FeatureParityResult[]> {
    console.log('🧪 Running feature parity tests...');

    const results: FeatureParityResult[] = [];

    for (const test of this.featureParityTests) {
      try {
        const startTime = Date.now();
        
        const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}${test.endpoint}`, {
          method: test.method,
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'SuccessValidator/1.0'
          },
          body: test.payload ? JSON.stringify(test.payload) : undefined,
          signal: AbortSignal.timeout(test.timeout)
        });

        const responseTime = Date.now() - startTime;
        const actualResponse = response.ok ? await response.json() : { error: `HTTP ${response.status}` };

        const passed = this.compareResponses(actualResponse, test.expectedResponse);

        results.push({
          testId: test.id,
          name: test.name,
          passed,
          actualResponse,
          expectedResponse: test.expectedResponse,
          responseTime,
          error: passed ? undefined : 'Response does not match expected format'
        });

      } catch (error) {
        results.push({
          testId: test.id,
          name: test.name,
          passed: false,
          actualResponse: null,
          expectedResponse: test.expectedResponse,
          responseTime: 0,
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    const passedTests = results.filter(r => r.passed).length;
    console.log(`🧪 Feature parity tests completed: ${passedTests}/${results.length} passed`);

    return results;
  }

  /**
   * Convert feature parity results to validation results
   */
  private convertFeatureParityToValidation(featureResults: FeatureParityResult[]): ValidationResult[] {
    return featureResults.map(result => ({
      criteriaId: `feature-parity-${result.testId}`,
      name: `Feature Parity: ${result.name}`,
      passed: result.passed,
      actualValue: result.passed ? 1 : 0,
      targetValue: 1,
      deviation: result.passed ? 0 : -100,
      message: result.passed 
        ? `${result.name} maintains feature parity`
        : `${result.name} failed: ${result.error || 'Response mismatch'}`,
      priority: 'critical' as const,
      category: 'feature_parity'
    }));
  }

  /**
   * Validate a single criteria
   */
  private validateSingleCriteria(
    criteria: SuccessCriteria,
    baseline: any,
    current: any,
    improvements: any
  ): ValidationResult {
    let actualValue: number;
    let passed: boolean;

    if (criteria.operator === 'percentage_improvement') {
      actualValue = improvements[criteria.metric] || 0;
      passed = actualValue >= criteria.target;
    } else {
      actualValue = current[criteria.metric] || 0;
      passed = this.evaluateCondition(actualValue, criteria.target, criteria.operator);
    }

    const deviation = ((actualValue - criteria.target) / criteria.target) * 100;

    return {
      criteriaId: criteria.id,
      name: criteria.name,
      passed,
      actualValue,
      targetValue: criteria.target,
      deviation,
      message: this.generateValidationMessage(criteria, actualValue, passed),
      priority: criteria.priority,
      category: criteria.category
    };
  }

  /**
   * Evaluate condition based on operator
   */
  private evaluateCondition(actual: number, target: number, operator: string): boolean {
    switch (operator) {
      case 'greater_than': return actual > target;
      case 'less_than': return actual < target;
      case 'equals': return Math.abs(actual - target) < 0.01;
      case 'greater_equal': return actual >= target;
      case 'less_equal': return actual <= target;
      case 'percentage_improvement': return actual >= target;
      default: return false;
    }
  }

  /**
   * Generate validation message
   */
  private generateValidationMessage(criteria: SuccessCriteria, actualValue: number, passed: boolean): string {
    const operatorText = {
      'greater_than': 'greater than',
      'less_than': 'less than',
      'equals': 'equal to',
      'greater_equal': 'at least',
      'less_equal': 'at most',
      'percentage_improvement': 'improved by at least'
    };

    const operator = operatorText[criteria.operator] || criteria.operator;
    const unit = criteria.operator === 'percentage_improvement' ? '%' : '';

    if (passed) {
      return `✅ ${criteria.name}: ${actualValue.toFixed(2)}${unit} (target: ${operator} ${criteria.target}${unit})`;
    } else {
      return `❌ ${criteria.name}: ${actualValue.toFixed(2)}${unit} (target: ${operator} ${criteria.target}${unit})`;
    }
  }

  /**
   * Compare API responses for feature parity
   */
  private compareResponses(actual: any, expected: any): boolean {
    if (typeof expected !== 'object' || expected === null) {
      return actual === expected;
    }

    for (const key in expected) {
      if (!(key in actual)) {
        return false;
      }
      
      // For arrays and objects, check structure rather than exact values
      if (Array.isArray(expected[key])) {
        if (!Array.isArray(actual[key])) {
          return false;
        }
      } else if (typeof expected[key] === 'object' && expected[key] !== null) {
        if (typeof actual[key] !== 'object' || actual[key] === null) {
          return false;
        }
      }
    }

    return true;
  }

  /**
   * Calculate summary statistics
   */
  private calculateSummary(results: ValidationResult[]): SuccessReport['summary'] {
    const categories = ['performance', 'cost', 'reliability', 'scalability', 'feature_parity'] as const;
    const summary: SuccessReport['summary'] = {} as any;

    for (const category of categories) {
      const categoryResults = results.filter(r => r.category === category);
      const passed = categoryResults.filter(r => r.passed).length;
      summary[category] = { passed, total: categoryResults.length };
    }

    return summary;
  }

  /**
   * Determine overall success
   */
  private determineOverallSuccess(results: ValidationResult[]): boolean {
    // All critical criteria must pass
    const criticalResults = results.filter(r => r.priority === 'critical');
    const criticalPassed = criticalResults.every(r => r.passed);

    // At least 80% of high priority criteria must pass
    const highResults = results.filter(r => r.priority === 'high');
    const highPassRate = highResults.length > 0 ? (highResults.filter(r => r.passed).length / highResults.length) : 1;

    // Overall pass rate must be at least 70%
    const overallPassRate = results.filter(r => r.passed).length / results.length;

    return criticalPassed && highPassRate >= 0.8 && overallPassRate >= 0.7;
  }

  /**
   * Generate recommendations based on validation results
   */
  private generateRecommendations(results: ValidationResult[]): string[] {
    const recommendations: string[] = [];
    const failedResults = results.filter(r => !r.passed);

    // Critical failures
    const criticalFailures = failedResults.filter(r => r.priority === 'critical');
    if (criticalFailures.length > 0) {
      recommendations.push('Address all critical failures immediately before proceeding with deployment');
      
      criticalFailures.forEach(failure => {
        if (failure.category === 'feature_parity') {
          recommendations.push(`Fix feature parity issue: ${failure.name}`);
        } else if (failure.criteriaId === 'function-count-reduction') {
          recommendations.push('Consolidate more functions to meet the 40% reduction target');
        } else if (failure.criteriaId === 'error-rate-maintenance') {
          recommendations.push('Investigate and fix sources of increased error rates');
        }
      });
    }

    // Performance failures
    const performanceFailures = failedResults.filter(r => r.category === 'performance');
    if (performanceFailures.length > 0) {
      recommendations.push('Optimize performance bottlenecks identified in failed criteria');
      
      if (performanceFailures.some(f => f.criteriaId === 'response-time-improvement')) {
        recommendations.push('Implement additional caching or optimize slow database queries');
      }
      
      if (performanceFailures.some(f => f.criteriaId === 'throughput-improvement')) {
        recommendations.push('Review function consolidation and connection pooling strategies');
      }
    }

    // Cost failures
    const costFailures = failedResults.filter(r => r.category === 'cost');
    if (costFailures.length > 0) {
      recommendations.push('Review cost optimization strategies to meet savings targets');
      recommendations.push('Consider additional function consolidation or edge computing optimizations');
    }

    // General recommendations
    if (failedResults.length > results.length * 0.3) {
      recommendations.push('Consider rolling back changes and re-evaluating optimization strategy');
    }

    if (recommendations.length === 0) {
      recommendations.push('All success criteria met - optimization is ready for production deployment');
    }

    return recommendations;
  }

  /**
   * Add custom success criteria
   */
  addSuccessCriteria(criteria: SuccessCriteria): void {
    this.successCriteria.push(criteria);
  }

  /**
   * Add custom feature parity test
   */
  addFeatureParityTest(test: FeatureParityTest): void {
    this.featureParityTests.push(test);
  }

  /**
   * Get all success criteria
   */
  getSuccessCriteria(): SuccessCriteria[] {
    return [...this.successCriteria];
  }

  /**
   * Get all feature parity tests
   */
  getFeatureParityTests(): FeatureParityTest[] {
    return [...this.featureParityTests];
  }
}

export const successValidator = new SuccessValidator();