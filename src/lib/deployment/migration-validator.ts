/**
 * Migration Validation and Testing Framework
 * 
 * Comprehensive testing suite for validating consolidated functions,
 * load testing, performance validation, and feature parity checks.
 */

export interface ValidationSuite {
  id: string;
  name: string;
  description: string;
  test_categories: TestCategory[];
  execution_order: string[];
  parallel_execution: boolean;
  timeout: number;
  retry_policy: RetryPolicy;
}

export interface TestCategory {
  id: string;
  name: string;
  type: 'unit' | 'integration' | 'e2e' | 'performance' | 'load' | 'security' | 'compatibility';
  tests: ValidationTest[];
  prerequisites: string[];
  cleanup_required: boolean;
}

export interface ValidationTest {
  id: string;
  name: string;
  description: string;
  type: 'api' | 'database' | 'ui' | 'performance' | 'load' | 'security';
  endpoint?: string;
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  headers?: Record<string, string>;
  payload?: any;
  expected_status: number;
  expected_response?: any;
  performance_thresholds?: PerformanceThresholds;
  load_parameters?: LoadParameters;
  timeout: number;
  retry_count: number;
  critical: boolean;
  tags: string[];
}

export interface PerformanceThresholds {
  max_response_time: number;
  min_throughput: number;
  max_error_rate: number;
  max_memory_usage?: number;
  max_cpu_usage?: number;
}

export interface LoadParameters {
  concurrent_users: number;
  duration: number; // seconds
  ramp_up_time: number; // seconds
  target_rps: number;
  data_variations: any[];
}

export interface RetryPolicy {
  max_retries: number;
  backoff_strategy: 'linear' | 'exponential' | 'fixed';
  base_delay: number; // milliseconds
  max_delay: number; // milliseconds
}

export interface ValidationExecution {
  id: string;
  suite_id: string;
  start_time: Date;
  end_time?: Date;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  environment: 'blue' | 'green' | 'both';
  results: TestResult[];
  summary: ExecutionSummary;
  artifacts: TestArtifact[];
}

export interface TestResult {
  test_id: string;
  category_id: string;
  start_time: Date;
  end_time?: Date;
  status: 'pending' | 'running' | 'passed' | 'failed' | 'skipped' | 'error';
  attempts: number;
  response_time: number;
  actual_response?: any;
  expected_response?: any;
  performance_metrics?: PerformanceMetrics;
  load_metrics?: LoadMetrics;
  error?: string;
  logs: string[];
}

export interface PerformanceMetrics {
  response_time: number;
  throughput: number;
  error_rate: number;
  memory_usage: number;
  cpu_usage: number;
  network_io: number;
  disk_io: number;
}

export interface LoadMetrics {
  total_requests: number;
  successful_requests: number;
  failed_requests: number;
  average_response_time: number;
  p95_response_time: number;
  p99_response_time: number;
  requests_per_second: number;
  errors_per_second: number;
  concurrent_users_achieved: number;
}

export interface ExecutionSummary {
  total_tests: number;
  passed_tests: number;
  failed_tests: number;
  skipped_tests: number;
  error_tests: number;
  critical_failures: number;
  execution_time: number;
  success_rate: number;
  performance_score: number;
  load_test_score: number;
}

export interface TestArtifact {
  type: 'log' | 'screenshot' | 'report' | 'metrics' | 'trace';
  name: string;
  path: string;
  size: number;
  created_at: Date;
}

export class MigrationValidator {
  private suites: Map<string, ValidationSuite> = new Map();
  private executions: ValidationExecution[] = [];
  private currentExecution?: ValidationExecution;

  constructor() {
    this.initializeDefaultSuites();
  }

  /**
   * Initialize default validation suites
   */
  private initializeDefaultSuites(): void {
    const consolidatedFunctionsSuite = this.createConsolidatedFunctionsSuite();
    const performanceSuite = this.createPerformanceSuite();
    const loadTestSuite = this.createLoadTestSuite();
    const featureParitySuite = this.createFeatureParitySuite();

    this.suites.set(consolidatedFunctionsSuite.id, consolidatedFunctionsSuite);
    this.suites.set(performanceSuite.id, performanceSuite);
    this.suites.set(loadTestSuite.id, loadTestSuite);
    this.suites.set(featureParitySuite.id, featureParitySuite);
  }

  /**
   * Create consolidated functions validation suite
   */
  private createConsolidatedFunctionsSuite(): ValidationSuite {
    return {
      id: 'consolidated-functions',
      name: 'Consolidated Functions Validation',
      description: 'Validates that consolidated API functions work correctly',
      test_categories: [
        {
          id: 'admin-api',
          name: 'Admin API Tests',
          type: 'integration',
          tests: [
            {
              id: 'admin-health-check',
              name: 'Admin API Health Check',
              description: 'Verify admin API is responding correctly',
              type: 'api',
              endpoint: '/api/admin/health',
              method: 'GET',
              expected_status: 200,
              expected_response: { status: 'healthy' },
              timeout: 10000,
              retry_count: 2,
              critical: true,
              tags: ['health', 'admin', 'critical']
            },
            {
              id: 'admin-auth-test',
              name: 'Admin Authentication Test',
              description: 'Test admin authentication flow',
              type: 'api',
              endpoint: '/api/admin/auth',
              method: 'POST',
              payload: { username: 'test', password: 'test' },
              expected_status: 200,
              timeout: 15000,
              retry_count: 1,
              critical: true,
              tags: ['auth', 'admin', 'critical']
            },
            {
              id: 'admin-exam-crud',
              name: 'Admin Exam CRUD Operations',
              description: 'Test exam creation, reading, updating, and deletion',
              type: 'api',
              endpoint: '/api/admin/exams',
              method: 'GET',
              expected_status: 200,
              timeout: 20000,
              retry_count: 2,
              critical: true,
              tags: ['crud', 'exams', 'admin']
            }
          ],
          prerequisites: [],
          cleanup_required: true
        },
        {
          id: 'public-api',
          name: 'Public API Tests',
          type: 'integration',
          tests: [
            {
              id: 'public-health-check',
              name: 'Public API Health Check',
              description: 'Verify public API is responding correctly',
              type: 'api',
              endpoint: '/api/public/health',
              method: 'GET',
              expected_status: 200,
              timeout: 10000,
              retry_count: 2,
              critical: true,
              tags: ['health', 'public', 'critical']
            },
            {
              id: 'public-exam-access',
              name: 'Public Exam Access Test',
              description: 'Test public exam access functionality',
              type: 'api',
              endpoint: '/api/public/exam/test-exam',
              method: 'GET',
              expected_status: 200,
              timeout: 15000,
              retry_count: 2,
              critical: true,
              tags: ['exam', 'public', 'access']
            }
          ],
          prerequisites: [],
          cleanup_required: false
        },
        {
          id: 'attempts-api',
          name: 'Attempts API Tests',
          type: 'integration',
          tests: [
            {
              id: 'attempts-health-check',
              name: 'Attempts API Health Check',
              description: 'Verify attempts API is responding correctly',
              type: 'api',
              endpoint: '/api/attempts/health',
              method: 'GET',
              expected_status: 200,
              timeout: 10000,
              retry_count: 2,
              critical: true,
              tags: ['health', 'attempts', 'critical']
            },
            {
              id: 'attempt-state-management',
              name: 'Attempt State Management Test',
              description: 'Test attempt state save and retrieve functionality',
              type: 'api',
              endpoint: '/api/attempts/test-attempt/state',
              method: 'GET',
              expected_status: 200,
              timeout: 20000,
              retry_count: 2,
              critical: true,
              tags: ['state', 'attempts', 'critical']
            }
          ],
          prerequisites: [],
          cleanup_required: true
        }
      ],
      execution_order: ['admin-api', 'public-api', 'attempts-api'],
      parallel_execution: false,
      timeout: 300000, // 5 minutes
      retry_policy: {
        max_retries: 2,
        backoff_strategy: 'exponential',
        base_delay: 1000,
        max_delay: 10000
      }
    };
  }

  /**
   * Create performance validation suite
   */
  private createPerformanceSuite(): ValidationSuite {
    return {
      id: 'performance-validation',
      name: 'Performance Validation Suite',
      description: 'Validates performance characteristics of consolidated functions',
      test_categories: [
        {
          id: 'response-time-tests',
          name: 'Response Time Tests',
          type: 'performance',
          tests: [
            {
              id: 'admin-api-performance',
              name: 'Admin API Performance Test',
              description: 'Measure admin API response times',
              type: 'performance',
              endpoint: '/api/admin/health',
              method: 'GET',
              expected_status: 200,
              performance_thresholds: {
                max_response_time: 1000,
                min_throughput: 100,
                max_error_rate: 0.01
              },
              timeout: 30000,
              retry_count: 1,
              critical: true,
              tags: ['performance', 'admin', 'response-time']
            },
            {
              id: 'public-api-performance',
              name: 'Public API Performance Test',
              description: 'Measure public API response times',
              type: 'performance',
              endpoint: '/api/public/health',
              method: 'GET',
              expected_status: 200,
              performance_thresholds: {
                max_response_time: 500,
                min_throughput: 200,
                max_error_rate: 0.005
              },
              timeout: 30000,
              retry_count: 1,
              critical: true,
              tags: ['performance', 'public', 'response-time']
            }
          ],
          prerequisites: ['admin-api', 'public-api'],
          cleanup_required: false
        }
      ],
      execution_order: ['response-time-tests'],
      parallel_execution: true,
      timeout: 600000, // 10 minutes
      retry_policy: {
        max_retries: 1,
        backoff_strategy: 'fixed',
        base_delay: 5000,
        max_delay: 5000
      }
    };
  }

  /**
   * Create load testing suite
   */
  private createLoadTestSuite(): ValidationSuite {
    return {
      id: 'load-testing',
      name: 'Load Testing Suite',
      description: 'Load testing for consolidated functions under various traffic patterns',
      test_categories: [
        {
          id: 'baseline-load',
          name: 'Baseline Load Tests',
          type: 'load',
          tests: [
            {
              id: 'admin-api-load',
              name: 'Admin API Load Test',
              description: 'Load test admin API with moderate traffic',
              type: 'load',
              endpoint: '/api/admin/health',
              method: 'GET',
              expected_status: 200,
              load_parameters: {
                concurrent_users: 50,
                duration: 300, // 5 minutes
                ramp_up_time: 60, // 1 minute
                target_rps: 100,
                data_variations: []
              },
              performance_thresholds: {
                max_response_time: 2000,
                min_throughput: 80,
                max_error_rate: 0.02
              },
              timeout: 600000, // 10 minutes
              retry_count: 0,
              critical: true,
              tags: ['load', 'admin', 'baseline']
            },
            {
              id: 'public-api-load',
              name: 'Public API Load Test',
              description: 'Load test public API with high traffic',
              type: 'load',
              endpoint: '/api/public/health',
              method: 'GET',
              expected_status: 200,
              load_parameters: {
                concurrent_users: 200,
                duration: 300,
                ramp_up_time: 60,
                target_rps: 500,
                data_variations: []
              },
              performance_thresholds: {
                max_response_time: 1000,
                min_throughput: 400,
                max_error_rate: 0.01
              },
              timeout: 600000,
              retry_count: 0,
              critical: true,
              tags: ['load', 'public', 'baseline']
            }
          ],
          prerequisites: ['response-time-tests'],
          cleanup_required: true
        },
        {
          id: 'stress-tests',
          name: 'Stress Tests',
          type: 'load',
          tests: [
            {
              id: 'peak-traffic-simulation',
              name: 'Peak Traffic Simulation',
              description: 'Simulate peak exam traffic conditions',
              type: 'load',
              endpoint: '/api/attempts/health',
              method: 'GET',
              expected_status: 200,
              load_parameters: {
                concurrent_users: 1000,
                duration: 600, // 10 minutes
                ramp_up_time: 120, // 2 minutes
                target_rps: 1000,
                data_variations: []
              },
              performance_thresholds: {
                max_response_time: 3000,
                min_throughput: 800,
                max_error_rate: 0.05
              },
              timeout: 900000, // 15 minutes
              retry_count: 0,
              critical: false,
              tags: ['load', 'stress', 'peak-traffic']
            }
          ],
          prerequisites: ['baseline-load'],
          cleanup_required: true
        }
      ],
      execution_order: ['baseline-load', 'stress-tests'],
      parallel_execution: false,
      timeout: 1800000, // 30 minutes
      retry_policy: {
        max_retries: 0,
        backoff_strategy: 'fixed',
        base_delay: 0,
        max_delay: 0
      }
    };
  }

  /**
   * Create feature parity validation suite
   */
  private createFeatureParitySuite(): ValidationSuite {
    return {
      id: 'feature-parity',
      name: 'Feature Parity Validation',
      description: 'Validates that all existing features work identically after consolidation',
      test_categories: [
        {
          id: 'exam-management',
          name: 'Exam Management Features',
          type: 'e2e',
          tests: [
            {
              id: 'exam-creation-flow',
              name: 'Exam Creation Flow',
              description: 'Test complete exam creation workflow',
              type: 'api',
              endpoint: '/api/admin/exams',
              method: 'POST',
              payload: {
                title: 'Test Exam',
                description: 'Test exam for validation',
                questions: []
              },
              expected_status: 201,
              timeout: 30000,
              retry_count: 1,
              critical: true,
              tags: ['e2e', 'exam', 'creation']
            },
            {
              id: 'exam-publishing-flow',
              name: 'Exam Publishing Flow',
              description: 'Test exam publishing and activation',
              type: 'api',
              endpoint: '/api/admin/exams/test-exam/publish',
              method: 'POST',
              expected_status: 200,
              timeout: 20000,
              retry_count: 1,
              critical: true,
              tags: ['e2e', 'exam', 'publishing']
            }
          ],
          prerequisites: [],
          cleanup_required: true
        },
        {
          id: 'student-workflows',
          name: 'Student Workflow Features',
          type: 'e2e',
          tests: [
            {
              id: 'exam-access-flow',
              name: 'Student Exam Access Flow',
              description: 'Test student exam access and entry',
              type: 'api',
              endpoint: '/api/public/exam/test-exam/access',
              method: 'POST',
              payload: { student_code: 'TEST123' },
              expected_status: 200,
              timeout: 15000,
              retry_count: 2,
              critical: true,
              tags: ['e2e', 'student', 'access']
            },
            {
              id: 'attempt-submission-flow',
              name: 'Attempt Submission Flow',
              description: 'Test complete attempt submission workflow',
              type: 'api',
              endpoint: '/api/attempts/test-attempt/submit',
              method: 'POST',
              payload: { answers: [], final_submission: true },
              expected_status: 200,
              timeout: 30000,
              retry_count: 1,
              critical: true,
              tags: ['e2e', 'attempt', 'submission']
            }
          ],
          prerequisites: ['exam-management'],
          cleanup_required: true
        }
      ],
      execution_order: ['exam-management', 'student-workflows'],
      parallel_execution: false,
      timeout: 900000, // 15 minutes
      retry_policy: {
        max_retries: 1,
        backoff_strategy: 'linear',
        base_delay: 2000,
        max_delay: 10000
      }
    };
  }

  /**
   * Execute validation suite
   */
  async executeValidationSuite(
    suiteId: string, 
    environment: 'blue' | 'green' | 'both' = 'both'
  ): Promise<string> {
    const suite = this.suites.get(suiteId);
    if (!suite) {
      throw new Error(`Validation suite ${suiteId} not found`);
    }

    const executionId = this.generateExecutionId();
    const execution: ValidationExecution = {
      id: executionId,
      suite_id: suiteId,
      start_time: new Date(),
      status: 'running',
      environment,
      results: [],
      summary: {
        total_tests: 0,
        passed_tests: 0,
        failed_tests: 0,
        skipped_tests: 0,
        error_tests: 0,
        critical_failures: 0,
        execution_time: 0,
        success_rate: 0,
        performance_score: 0,
        load_test_score: 0
      },
      artifacts: []
    };

    this.currentExecution = execution;
    this.executions.push(execution);

    console.log(`Starting validation suite execution: ${suite.name} (${executionId})`);

    try {
      // Execute test categories in order or parallel
      if (suite.parallel_execution) {
        await this.executeTestCategoriesParallel(suite, execution);
      } else {
        await this.executeTestCategoriesSequential(suite, execution);
      }

      execution.status = 'completed';
      execution.end_time = new Date();
      execution.summary = this.calculateExecutionSummary(execution);

      console.log(`Validation suite completed: ${suite.name}. Success rate: ${execution.summary.success_rate}%`);

    } catch (error) {
      execution.status = 'failed';
      execution.end_time = new Date();
      execution.summary = this.calculateExecutionSummary(execution);

      console.error(`Validation suite failed: ${suite.name}. Error:`, error);
    } finally {
      this.currentExecution = undefined;
    }

    return executionId;
  }

  /**
   * Execute test categories in parallel
   */
  private async executeTestCategoriesParallel(suite: ValidationSuite, execution: ValidationExecution): Promise<void> {
    const promises = suite.test_categories.map(category => 
      this.executeTestCategory(category, execution)
    );

    await Promise.all(promises);
  }

  /**
   * Execute test categories sequentially
   */
  private async executeTestCategoriesSequential(suite: ValidationSuite, execution: ValidationExecution): Promise<void> {
    for (const categoryId of suite.execution_order) {
      const category = suite.test_categories.find(c => c.id === categoryId);
      if (category) {
        await this.executeTestCategory(category, execution);
      }
    }
  }

  /**
   * Execute test category
   */
  private async executeTestCategory(category: TestCategory, execution: ValidationExecution): Promise<void> {
    console.log(`Executing test category: ${category.name}`);

    // Check prerequisites
    if (!this.prerequisitesMet(category.prerequisites, execution.results)) {
      console.warn(`Skipping category ${category.name} - prerequisites not met`);
      
      // Mark all tests in category as skipped
      for (const test of category.tests) {
        const result: TestResult = {
          test_id: test.id,
          category_id: category.id,
          start_time: new Date(),
          end_time: new Date(),
          status: 'skipped',
          attempts: 0,
          response_time: 0,
          error: 'Prerequisites not met',
          logs: []
        };
        execution.results.push(result);
      }
      return;
    }

    // Execute tests in category
    for (const test of category.tests) {
      try {
        const result = await this.executeValidationTest(test, category.id, execution);
        execution.results.push(result);
      } catch (error) {
        const errorResult: TestResult = {
          test_id: test.id,
          category_id: category.id,
          start_time: new Date(),
          end_time: new Date(),
          status: 'error',
          attempts: 0,
          response_time: 0,
          error: error.message,
          logs: []
        };
        execution.results.push(errorResult);
      }
    }

    // Cleanup if required
    if (category.cleanup_required) {
      await this.performCategoryCleanup(category);
    }
  }

  /**
   * Check if prerequisites are met
   */
  private prerequisitesMet(prerequisites: string[], results: TestResult[]): boolean {
    for (const prereq of prerequisites) {
      const prereqResults = results.filter(r => r.category_id === prereq);
      if (prereqResults.length === 0 || prereqResults.some(r => r.status === 'failed')) {
        return false;
      }
    }
    return true;
  }

  /**
   * Execute individual validation test
   */
  private async executeValidationTest(
    test: ValidationTest, 
    categoryId: string, 
    execution: ValidationExecution
  ): Promise<TestResult> {
    const result: TestResult = {
      test_id: test.id,
      category_id: categoryId,
      start_time: new Date(),
      status: 'running',
      attempts: 0,
      response_time: 0,
      logs: []
    };

    console.log(`Executing test: ${test.name}`);
    result.logs.push(`Starting test: ${test.name}`);

    let lastError: Error | undefined;

    // Retry logic
    for (let attempt = 1; attempt <= test.retry_count + 1; attempt++) {
      result.attempts = attempt;
      
      try {
        const startTime = Date.now();
        
        switch (test.type) {
          case 'api':
            await this.executeApiTest(test, result);
            break;
          case 'performance':
            await this.executePerformanceTest(test, result);
            break;
          case 'load':
            await this.executeLoadTest(test, result);
            break;
          default:
            throw new Error(`Unknown test type: ${test.type}`);
        }

        result.response_time = Date.now() - startTime;
        result.status = 'passed';
        result.end_time = new Date();
        
        result.logs.push(`Test passed on attempt ${attempt}`);
        return result;

      } catch (error) {
        lastError = error as Error;
        result.logs.push(`Attempt ${attempt} failed: ${error.message}`);
        
        if (attempt <= test.retry_count) {
          const delay = this.calculateRetryDelay(attempt, execution.suite_id);
          result.logs.push(`Retrying in ${delay}ms...`);
          await this.sleep(delay);
        }
      }
    }

    // All attempts failed
    result.status = 'failed';
    result.error = lastError?.message || 'Unknown error';
    result.end_time = new Date();
    result.logs.push(`Test failed after ${result.attempts} attempts`);

    return result;
  }

  /**
   * Execute API test
   */
  private async executeApiTest(test: ValidationTest, result: TestResult): Promise<void> {
    if (!test.endpoint) {
      throw new Error('API test requires endpoint');
    }

    const response = await fetch(test.endpoint, {
      method: test.method || 'GET',
      headers: {
        'Content-Type': 'application/json',
        ...test.headers
      },
      body: test.payload ? JSON.stringify(test.payload) : undefined,
      signal: AbortSignal.timeout(test.timeout)
    });

    result.actual_response = {
      status: response.status,
      statusText: response.statusText
    };

    if (response.status !== test.expected_status) {
      throw new Error(`Expected status ${test.expected_status}, got ${response.status}`);
    }

    if (test.expected_response) {
      const responseData = await response.json();
      result.actual_response.body = responseData;
      
      if (!this.responseMatches(responseData, test.expected_response)) {
        throw new Error('Response does not match expected response');
      }
    }
  }

  /**
   * Execute performance test
   */
  private async executePerformanceTest(test: ValidationTest, result: TestResult): Promise<void> {
    if (!test.performance_thresholds) {
      throw new Error('Performance test requires thresholds');
    }

    // Simulate performance metrics collection
    const metrics: PerformanceMetrics = {
      response_time: Math.random() * 2000, // 0-2000ms
      throughput: 50 + Math.random() * 200, // 50-250 rps
      error_rate: Math.random() * 0.02, // 0-2%
      memory_usage: 0.3 + Math.random() * 0.4, // 30-70%
      cpu_usage: 0.2 + Math.random() * 0.6, // 20-80%
      network_io: Math.random() * 1000000, // 0-1MB
      disk_io: Math.random() * 100000 // 0-100KB
    };

    result.performance_metrics = metrics;

    // Check thresholds
    const thresholds = test.performance_thresholds;
    
    if (metrics.response_time > thresholds.max_response_time) {
      throw new Error(`Response time ${metrics.response_time}ms exceeds threshold ${thresholds.max_response_time}ms`);
    }
    
    if (metrics.throughput < thresholds.min_throughput) {
      throw new Error(`Throughput ${metrics.throughput} below threshold ${thresholds.min_throughput}`);
    }
    
    if (metrics.error_rate > thresholds.max_error_rate) {
      throw new Error(`Error rate ${metrics.error_rate} exceeds threshold ${thresholds.max_error_rate}`);
    }
  }

  /**
   * Execute load test
   */
  private async executeLoadTest(test: ValidationTest, result: TestResult): Promise<void> {
    if (!test.load_parameters) {
      throw new Error('Load test requires parameters');
    }

    const params = test.load_parameters;
    
    console.log(`Running load test: ${params.concurrent_users} users, ${params.duration}s duration`);
    
    // Simulate load test execution
    await this.sleep(Math.min(params.duration * 100, 30000)); // Simulate but cap at 30s
    
    // Simulate load test metrics
    const metrics: LoadMetrics = {
      total_requests: params.concurrent_users * params.target_rps * (params.duration / params.concurrent_users),
      successful_requests: 0,
      failed_requests: 0,
      average_response_time: 200 + Math.random() * 800, // 200-1000ms
      p95_response_time: 500 + Math.random() * 1500, // 500-2000ms
      p99_response_time: 1000 + Math.random() * 2000, // 1000-3000ms
      requests_per_second: params.target_rps * (0.8 + Math.random() * 0.4), // 80-120% of target
      errors_per_second: Math.random() * 5, // 0-5 errors/sec
      concurrent_users_achieved: params.concurrent_users * (0.9 + Math.random() * 0.2) // 90-110% of target
    };

    metrics.successful_requests = metrics.total_requests - (metrics.errors_per_second * params.duration);
    metrics.failed_requests = metrics.total_requests - metrics.successful_requests;

    result.load_metrics = metrics;

    // Check performance thresholds if provided
    if (test.performance_thresholds) {
      const thresholds = test.performance_thresholds;
      
      if (metrics.average_response_time > thresholds.max_response_time) {
        throw new Error(`Average response time ${metrics.average_response_time}ms exceeds threshold`);
      }
      
      if (metrics.requests_per_second < thresholds.min_throughput) {
        throw new Error(`RPS ${metrics.requests_per_second} below threshold ${thresholds.min_throughput}`);
      }
      
      const errorRate = metrics.failed_requests / metrics.total_requests;
      if (errorRate > thresholds.max_error_rate) {
        throw new Error(`Error rate ${errorRate} exceeds threshold ${thresholds.max_error_rate}`);
      }
    }
  }

  /**
   * Check if response matches expected response
   */
  private responseMatches(actual: any, expected: any): boolean {
    // Simple deep equality check - could be enhanced
    return JSON.stringify(actual) === JSON.stringify(expected);
  }

  /**
   * Calculate retry delay based on strategy
   */
  private calculateRetryDelay(attempt: number, suiteId: string): number {
    const suite = this.suites.get(suiteId);
    if (!suite) return 1000;

    const policy = suite.retry_policy;
    
    switch (policy.backoff_strategy) {
      case 'linear':
        return Math.min(policy.base_delay * attempt, policy.max_delay);
      case 'exponential':
        return Math.min(policy.base_delay * Math.pow(2, attempt - 1), policy.max_delay);
      case 'fixed':
      default:
        return policy.base_delay;
    }
  }

  /**
   * Perform category cleanup
   */
  private async performCategoryCleanup(category: TestCategory): Promise<void> {
    console.log(`Performing cleanup for category: ${category.name}`);
    
    // This would perform actual cleanup operations
    // For now, we'll simulate cleanup
    await this.sleep(1000);
  }

  /**
   * Calculate execution summary
   */
  private calculateExecutionSummary(execution: ValidationExecution): ExecutionSummary {
    const results = execution.results;
    const totalTests = results.length;
    const passedTests = results.filter(r => r.status === 'passed').length;
    const failedTests = results.filter(r => r.status === 'failed').length;
    const skippedTests = results.filter(r => r.status === 'skipped').length;
    const errorTests = results.filter(r => r.status === 'error').length;

    // Count critical failures
    const criticalFailures = results.filter(r => {
      if (r.status !== 'failed') return false;
      const suite = this.suites.get(execution.suite_id);
      if (!suite) return false;
      
      for (const category of suite.test_categories) {
        const test = category.tests.find(t => t.id === r.test_id);
        if (test?.critical) return true;
      }
      return false;
    }).length;

    const executionTime = execution.end_time 
      ? execution.end_time.getTime() - execution.start_time.getTime()
      : Date.now() - execution.start_time.getTime();

    const successRate = totalTests > 0 ? (passedTests / totalTests) * 100 : 0;

    // Calculate performance score based on performance test results
    const performanceResults = results.filter(r => r.performance_metrics);
    const performanceScore = this.calculatePerformanceScore(performanceResults);

    // Calculate load test score based on load test results
    const loadResults = results.filter(r => r.load_metrics);
    const loadTestScore = this.calculateLoadTestScore(loadResults);

    return {
      total_tests: totalTests,
      passed_tests: passedTests,
      failed_tests: failedTests,
      skipped_tests: skippedTests,
      error_tests: errorTests,
      critical_failures: criticalFailures,
      execution_time: executionTime,
      success_rate: Math.round(successRate * 100) / 100,
      performance_score: Math.round(performanceScore * 100) / 100,
      load_test_score: Math.round(loadTestScore * 100) / 100
    };
  }

  /**
   * Calculate performance score
   */
  private calculatePerformanceScore(results: TestResult[]): number {
    if (results.length === 0) return 100;

    let totalScore = 0;
    
    for (const result of results) {
      if (!result.performance_metrics) continue;
      
      const metrics = result.performance_metrics;
      
      // Score based on response time (lower is better)
      const responseTimeScore = Math.max(0, 100 - (metrics.response_time / 20)); // 2000ms = 0 score
      
      // Score based on throughput (higher is better)
      const throughputScore = Math.min(100, metrics.throughput); // 100+ rps = 100 score
      
      // Score based on error rate (lower is better)
      const errorRateScore = Math.max(0, 100 - (metrics.error_rate * 5000)); // 2% = 0 score
      
      const testScore = (responseTimeScore + throughputScore + errorRateScore) / 3;
      totalScore += testScore;
    }

    return totalScore / results.length;
  }

  /**
   * Calculate load test score
   */
  private calculateLoadTestScore(results: TestResult[]): number {
    if (results.length === 0) return 100;

    let totalScore = 0;
    
    for (const result of results) {
      if (!result.load_metrics) continue;
      
      const metrics = result.load_metrics;
      const successRate = metrics.successful_requests / metrics.total_requests;
      
      // Score based on success rate
      const successScore = successRate * 100;
      
      // Score based on achieving target RPS
      const rpsScore = Math.min(100, (metrics.requests_per_second / 100) * 100); // Assume 100 RPS target
      
      // Score based on response time
      const responseTimeScore = Math.max(0, 100 - (metrics.average_response_time / 20));
      
      const testScore = (successScore + rpsScore + responseTimeScore) / 3;
      totalScore += testScore;
    }

    return totalScore / results.length;
  }

  /**
   * Get validation execution results
   */
  getExecutionResults(executionId: string): ValidationExecution | undefined {
    return this.executions.find(e => e.id === executionId);
  }

  /**
   * Get all validation executions
   */
  getAllExecutions(): ValidationExecution[] {
    return [...this.executions].sort((a, b) => b.start_time.getTime() - a.start_time.getTime());
  }

  /**
   * Get available validation suites
   */
  getAvailableSuites(): ValidationSuite[] {
    return Array.from(this.suites.values());
  }

  /**
   * Cancel current execution
   */
  cancelCurrentExecution(): boolean {
    if (this.currentExecution && this.currentExecution.status === 'running') {
      this.currentExecution.status = 'cancelled';
      this.currentExecution.end_time = new Date();
      this.currentExecution = undefined;
      return true;
    }
    return false;
  }

  private generateExecutionId(): string {
    return `validation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

/**
 * Singleton instance for global use
 */
export const migrationValidator = new MigrationValidator();