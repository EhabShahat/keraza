/**
 * Load Testing System
 * Simulates real-world usage patterns for performance validation
 */

import { BenchmarkTest } from './performance-benchmarker';

export interface LoadTestScenario {
  name: string;
  description: string;
  duration: number; // milliseconds
  concurrentUsers: number;
  rampUpTime: number; // milliseconds
  tests: BenchmarkTest[];
  userBehavior: UserBehaviorPattern;
}

export interface UserBehaviorPattern {
  thinkTime: { min: number; max: number }; // milliseconds between requests
  sessionDuration: { min: number; max: number }; // milliseconds
  requestDistribution: { [endpoint: string]: number }; // percentage
}

export interface LoadTestResult {
  scenario: string;
  startTime: Date;
  endTime: Date;
  totalRequests: number;
  successfulRequests: number;
  failedRequests: number;
  averageResponseTime: number;
  maxResponseTime: number;
  minResponseTime: number;
  throughput: number; // requests per second
  errorRate: number;
  concurrentUsers: number;
  resourceUtilization: {
    cpu: number;
    memory: number;
    database: number;
  };
}

export class LoadTester {
  private activeTests: Map<string, AbortController> = new Map();

  /**
   * Get predefined load test scenarios
   */
  getScenarios(): LoadTestScenario[] {
    return [
      this.getExamTakingScenario(),
      this.getAdminManagementScenario(),
      this.getPublicAccessScenario(),
      this.getPeakTrafficScenario(),
      this.getStressTestScenario()
    ];
  }

  /**
   * Exam taking scenario - simulates students taking exams
   */
  private getExamTakingScenario(): LoadTestScenario {
    return {
      name: 'exam-taking',
      description: 'Simulates students taking exams with typical behavior patterns',
      duration: 300000, // 5 minutes
      concurrentUsers: 50,
      rampUpTime: 30000, // 30 seconds
      tests: [
        {
          id: 'exam-entry',
          name: 'Exam Entry',
          endpoint: '/api/public/exam-access',
          method: 'POST',
          payload: { examId: 'test-exam', studentCode: 'TEST001' },
          expectedStatus: 200,
          timeout: 5000,
          iterations: 1
        },
        {
          id: 'attempt-start',
          name: 'Start Attempt',
          endpoint: '/api/attempts/start',
          method: 'POST',
          payload: { examId: 'test-exam' },
          expectedStatus: 201,
          timeout: 5000,
          iterations: 1
        },
        {
          id: 'attempt-save',
          name: 'Save Progress',
          endpoint: '/api/attempts/[attemptId]/save',
          method: 'POST',
          payload: { answers: { '1': 'A', '2': 'B' } },
          expectedStatus: 200,
          timeout: 3000,
          iterations: 10
        },
        {
          id: 'attempt-submit',
          name: 'Submit Attempt',
          endpoint: '/api/attempts/[attemptId]/submit',
          method: 'POST',
          payload: { final: true },
          expectedStatus: 200,
          timeout: 10000,
          iterations: 1
        }
      ],
      userBehavior: {
        thinkTime: { min: 2000, max: 15000 },
        sessionDuration: { min: 600000, max: 3600000 }, // 10-60 minutes
        requestDistribution: {
          'exam-entry': 5,
          'attempt-start': 5,
          'attempt-save': 80,
          'attempt-submit': 10
        }
      }
    };
  }

  /**
   * Admin management scenario - simulates admin activities
   */
  private getAdminManagementScenario(): LoadTestScenario {
    return {
      name: 'admin-management',
      description: 'Simulates admin users managing exams and monitoring system',
      duration: 180000, // 3 minutes
      concurrentUsers: 5,
      rampUpTime: 10000, // 10 seconds
      tests: [
        {
          id: 'admin-login',
          name: 'Admin Login',
          endpoint: '/api/admin/auth/login',
          method: 'POST',
          payload: { username: 'admin', password: 'test' },
          expectedStatus: 200,
          timeout: 5000,
          iterations: 1
        },
        {
          id: 'exam-list',
          name: 'List Exams',
          endpoint: '/api/admin/exams',
          method: 'GET',
          expectedStatus: 200,
          timeout: 3000,
          iterations: 5
        },
        {
          id: 'monitoring-dashboard',
          name: 'Monitoring Dashboard',
          endpoint: '/api/admin/monitoring/status',
          method: 'GET',
          expectedStatus: 200,
          timeout: 3000,
          iterations: 10
        },
        {
          id: 'results-export',
          name: 'Export Results',
          endpoint: '/api/admin/results/export',
          method: 'POST',
          payload: { examId: 'test-exam', format: 'csv' },
          expectedStatus: 200,
          timeout: 15000,
          iterations: 2
        }
      ],
      userBehavior: {
        thinkTime: { min: 1000, max: 5000 },
        sessionDuration: { min: 300000, max: 1800000 }, // 5-30 minutes
        requestDistribution: {
          'admin-login': 5,
          'exam-list': 20,
          'monitoring-dashboard': 60,
          'results-export': 15
        }
      }
    };
  }

  /**
   * Public access scenario - simulates public exam information access
   */
  private getPublicAccessScenario(): LoadTestScenario {
    return {
      name: 'public-access',
      description: 'Simulates public users accessing exam information and results',
      duration: 120000, // 2 minutes
      concurrentUsers: 100,
      rampUpTime: 20000, // 20 seconds
      tests: [
        {
          id: 'system-status',
          name: 'System Status',
          endpoint: '/api/public/system-status',
          method: 'GET',
          expectedStatus: 200,
          timeout: 3000,
          iterations: 1
        },
        {
          id: 'exam-info',
          name: 'Exam Information',
          endpoint: '/api/public/exam-info',
          method: 'GET',
          expectedStatus: 200,
          timeout: 3000,
          iterations: 3
        },
        {
          id: 'results-check',
          name: 'Check Results',
          endpoint: '/api/public/results',
          method: 'POST',
          payload: { studentCode: 'TEST001' },
          expectedStatus: 200,
          timeout: 5000,
          iterations: 2
        }
      ],
      userBehavior: {
        thinkTime: { min: 500, max: 3000 },
        sessionDuration: { min: 60000, max: 300000 }, // 1-5 minutes
        requestDistribution: {
          'system-status': 30,
          'exam-info': 50,
          'results-check': 20
        }
      }
    };
  }

  /**
   * Peak traffic scenario - simulates high traffic periods
   */
  private getPeakTrafficScenario(): LoadTestScenario {
    return {
      name: 'peak-traffic',
      description: 'Simulates peak traffic with high concurrent users',
      duration: 600000, // 10 minutes
      concurrentUsers: 200,
      rampUpTime: 60000, // 1 minute
      tests: [
        {
          id: 'mixed-load',
          name: 'Mixed Load Test',
          endpoint: '/api/public/health',
          method: 'GET',
          expectedStatus: 200,
          timeout: 5000,
          iterations: 100
        }
      ],
      userBehavior: {
        thinkTime: { min: 100, max: 1000 },
        sessionDuration: { min: 300000, max: 900000 }, // 5-15 minutes
        requestDistribution: {
          'mixed-load': 100
        }
      }
    };
  }

  /**
   * Stress test scenario - pushes system to limits
   */
  private getStressTestScenario(): LoadTestScenario {
    return {
      name: 'stress-test',
      description: 'Stress test to identify system breaking points',
      duration: 300000, // 5 minutes
      concurrentUsers: 500,
      rampUpTime: 120000, // 2 minutes
      tests: [
        {
          id: 'stress-load',
          name: 'Stress Load Test',
          endpoint: '/api/public/health',
          method: 'GET',
          expectedStatus: 200,
          timeout: 10000,
          iterations: 50
        }
      ],
      userBehavior: {
        thinkTime: { min: 50, max: 500 },
        sessionDuration: { min: 180000, max: 600000 }, // 3-10 minutes
        requestDistribution: {
          'stress-load': 100
        }
      }
    };
  }

  /**
   * Run a load test scenario
   */
  async runLoadTest(scenario: LoadTestScenario): Promise<LoadTestResult> {
    console.log(`🚀 Starting load test: ${scenario.name}`);
    console.log(`👥 Concurrent users: ${scenario.concurrentUsers}`);
    console.log(`⏱️ Duration: ${scenario.duration / 1000}s`);

    const testId = `${scenario.name}-${Date.now()}`;
    const controller = new AbortController();
    this.activeTests.set(testId, controller);

    const startTime = new Date();
    const results = {
      scenario: scenario.name,
      startTime,
      endTime: new Date(),
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      maxResponseTime: 0,
      minResponseTime: Infinity,
      throughput: 0,
      errorRate: 0,
      concurrentUsers: scenario.concurrentUsers,
      resourceUtilization: {
        cpu: 0,
        memory: 0,
        database: 0
      }
    };

    const responseTimes: number[] = [];
    const userPromises: Promise<void>[] = [];

    // Ramp up users gradually
    const rampUpInterval = scenario.rampUpTime / scenario.concurrentUsers;
    
    for (let i = 0; i < scenario.concurrentUsers; i++) {
      const userPromise = new Promise<void>((resolve) => {
        setTimeout(async () => {
          await this.simulateUser(scenario, results, responseTimes, controller.signal);
          resolve();
        }, i * rampUpInterval);
      });
      
      userPromises.push(userPromise);
    }

    // Wait for test duration
    setTimeout(() => {
      controller.abort();
    }, scenario.duration);

    // Wait for all users to complete
    await Promise.allSettled(userPromises);

    // Calculate final metrics
    results.endTime = new Date();
    results.errorRate = results.totalRequests > 0 
      ? (results.failedRequests / results.totalRequests) * 100 
      : 0;
    results.averageResponseTime = responseTimes.length > 0 
      ? responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length 
      : 0;
    results.maxResponseTime = responseTimes.length > 0 
      ? Math.max(...responseTimes) 
      : 0;
    results.minResponseTime = responseTimes.length > 0 
      ? Math.min(...responseTimes) 
      : 0;
    results.throughput = results.totalRequests / ((results.endTime.getTime() - results.startTime.getTime()) / 1000);

    // Get resource utilization
    results.resourceUtilization = await this.getResourceUtilization();

    this.activeTests.delete(testId);

    console.log(`✅ Load test completed: ${scenario.name}`);
    console.log(`📊 Results: ${results.successfulRequests}/${results.totalRequests} successful (${results.errorRate.toFixed(2)}% error rate)`);
    console.log(`⚡ Throughput: ${results.throughput.toFixed(2)} req/s`);
    console.log(`⏱️ Avg response time: ${results.averageResponseTime.toFixed(2)}ms`);

    return results;
  }

  /**
   * Simulate a single user's behavior
   */
  private async simulateUser(
    scenario: LoadTestScenario,
    results: LoadTestResult,
    responseTimes: number[],
    signal: AbortSignal
  ): Promise<void> {
    const sessionStart = Date.now();
    const sessionDuration = this.randomBetween(
      scenario.userBehavior.sessionDuration.min,
      scenario.userBehavior.sessionDuration.max
    );

    while (!signal.aborted && (Date.now() - sessionStart) < sessionDuration) {
      // Select a test based on distribution
      const test = this.selectTestByDistribution(scenario.tests, scenario.userBehavior.requestDistribution);
      
      if (test) {
        const requestStart = Date.now();
        results.totalRequests++;

        try {
          const response = await fetch(test.endpoint, {
            method: test.method,
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'LoadTester/1.0'
            },
            body: test.payload ? JSON.stringify(test.payload) : undefined,
            signal: AbortSignal.timeout(test.timeout)
          });

          const responseTime = Date.now() - requestStart;
          responseTimes.push(responseTime);

          if (response.status === test.expectedStatus) {
            results.successfulRequests++;
          } else {
            results.failedRequests++;
          }
        } catch (error) {
          results.failedRequests++;
        }
      }

      // Think time between requests
      const thinkTime = this.randomBetween(
        scenario.userBehavior.thinkTime.min,
        scenario.userBehavior.thinkTime.max
      );
      
      await new Promise(resolve => setTimeout(resolve, thinkTime));
    }
  }

  /**
   * Select a test based on distribution percentages
   */
  private selectTestByDistribution(tests: BenchmarkTest[], distribution: { [key: string]: number }): BenchmarkTest | null {
    const random = Math.random() * 100;
    let cumulative = 0;

    for (const test of tests) {
      const percentage = distribution[test.id] || 0;
      cumulative += percentage;
      
      if (random <= cumulative) {
        return test;
      }
    }

    return tests[0] || null;
  }

  /**
   * Generate random number between min and max
   */
  private randomBetween(min: number, max: number): number {
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  /**
   * Get current resource utilization
   */
  private async getResourceUtilization(): Promise<{ cpu: number; memory: number; database: number }> {
    try {
      const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/admin/monitoring/status`);
      if (response.ok) {
        const data = await response.json();
        return {
          cpu: data.resourceUtilization?.cpu || 0,
          memory: data.resourceUtilization?.memory || 0,
          database: data.resourceUtilization?.database || 0
        };
      }
    } catch (error) {
      console.warn('Failed to get resource utilization:', error);
    }

    return { cpu: 0, memory: 0, database: 0 };
  }

  /**
   * Stop a running load test
   */
  stopLoadTest(testId: string): void {
    const controller = this.activeTests.get(testId);
    if (controller) {
      controller.abort();
      this.activeTests.delete(testId);
      console.log(`🛑 Stopped load test: ${testId}`);
    }
  }

  /**
   * Stop all running load tests
   */
  stopAllLoadTests(): void {
    for (const [testId, controller] of this.activeTests) {
      controller.abort();
      console.log(`🛑 Stopped load test: ${testId}`);
    }
    this.activeTests.clear();
  }

  /**
   * Get active load tests
   */
  getActiveTests(): string[] {
    return Array.from(this.activeTests.keys());
  }
}

export const loadTester = new LoadTester();