/**
 * Tests for Performance Benchmarking System
 */

import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { PerformanceBenchmarker, BenchmarkTest, BenchmarkMetrics } from '../performance-benchmarker';
import { LoadTester } from '../load-testing';
import { RegressionDetector } from '../regression-detector';

// Mock fetch globally
global.fetch = vi.fn();

describe('PerformanceBenchmarker', () => {
  let benchmarker: PerformanceBenchmarker;

  beforeEach(() => {
    benchmarker = new PerformanceBenchmarker();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('establishBaseline', () => {
    it('should establish performance baseline', async () => {
      // Mock successful responses
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ status: 'healthy' })
      } as Response);

      const baseline = await benchmarker.establishBaseline();

      expect(baseline).toBeDefined();
      expect(baseline.timestamp).toBeInstanceOf(Date);
      expect(typeof baseline.responseTime).toBe('number');
      expect(typeof baseline.throughput).toBe('number');
      expect(typeof baseline.errorRate).toBe('number');
    });

    it('should handle baseline establishment errors gracefully', async () => {
      // Mock failed response
      vi.mocked(fetch).mockRejectedValueOnce(new Error('Network error'));

      const baseline = await benchmarker.establishBaseline();

      // Should still return baseline with default values
      expect(baseline).toBeDefined();
      expect(baseline.responseTime).toBeGreaterThanOrEqual(0);
    });
  });

  describe('runBenchmarkSuite', () => {
    it('should run benchmark tests successfully', async () => {
      const tests: BenchmarkTest[] = [
        {
          id: 'test-1',
          name: 'Test Endpoint',
          endpoint: '/api/test',
          method: 'GET',
          expectedStatus: 200,
          timeout: 5000,
          iterations: 3
        }
      ];

      // Mock successful responses
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ok' })
      } as Response);

      const results = await benchmarker.runBenchmarkSuite(tests);

      expect(results).toHaveLength(1);
      expect(results[0].testId).toBe('test-1');
      expect(results[0].success).toBe(true);
      expect(results[0].iterations).toBe(3);
    });

    it('should handle test failures correctly', async () => {
      const tests: BenchmarkTest[] = [
        {
          id: 'failing-test',
          name: 'Failing Test',
          endpoint: '/api/fail',
          method: 'GET',
          expectedStatus: 200,
          timeout: 5000,
          iterations: 2
        }
      ];

      // Mock failed responses
      vi.mocked(fetch).mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({ error: 'Server error' })
      } as Response);

      const results = await benchmarker.runBenchmarkSuite(tests);

      expect(results).toHaveLength(1);
      expect(results[0].success).toBe(false);
      expect(results[0].errors.length).toBeGreaterThan(0);
    });
  });

  describe('compareWithBaseline', () => {
    it('should compare current metrics with baseline', async () => {
      // Establish baseline first
      await benchmarker.establishBaseline();

      const currentMetrics: BenchmarkMetrics = {
        responseTime: 150, // Slower than baseline
        throughput: 120,   // Better than baseline
        errorRate: 0.5,
        memoryUsage: 100,
        cpuUsage: 50,
        functionCount: 45,
        cacheHitRate: 85,
        databaseQueryTime: 25,
        timestamp: new Date()
      };

      const comparison = await benchmarker.compareWithBaseline(currentMetrics);

      expect(comparison).toBeDefined();
      expect(comparison.baseline).toBeDefined();
      expect(comparison.current).toEqual(currentMetrics);
      expect(comparison.improvements).toBeDefined();
      expect(typeof comparison.overallScore).toBe('number');
    });

    it('should throw error when no baseline exists', async () => {
      const currentMetrics: BenchmarkMetrics = {
        responseTime: 100,
        throughput: 100,
        errorRate: 0,
        memoryUsage: 100,
        cpuUsage: 50,
        functionCount: 50,
        cacheHitRate: 80,
        databaseQueryTime: 20,
        timestamp: new Date()
      };

      await expect(benchmarker.compareWithBaseline(currentMetrics))
        .rejects.toThrow('No baseline metrics available');
    });
  });
});

describe('LoadTester', () => {
  let loadTester: LoadTester;

  beforeEach(() => {
    loadTester = new LoadTester();
    vi.clearAllMocks();
  });

  describe('getScenarios', () => {
    it('should return predefined load test scenarios', () => {
      const scenarios = loadTester.getScenarios();

      expect(scenarios).toHaveLength(5);
      expect(scenarios[0].name).toBe('exam-taking');
      expect(scenarios[1].name).toBe('admin-management');
      expect(scenarios[2].name).toBe('public-access');
      expect(scenarios[3].name).toBe('peak-traffic');
      expect(scenarios[4].name).toBe('stress-test');
    });

    it('should have valid scenario configurations', () => {
      const scenarios = loadTester.getScenarios();

      scenarios.forEach(scenario => {
        expect(scenario.name).toBeTruthy();
        expect(scenario.description).toBeTruthy();
        expect(scenario.duration).toBeGreaterThan(0);
        expect(scenario.concurrentUsers).toBeGreaterThan(0);
        expect(scenario.tests).toBeInstanceOf(Array);
        expect(scenario.userBehavior).toBeDefined();
      });
    });
  });

  describe('runLoadTest', () => {
    it('should run load test with short duration for testing', async () => {
      // Mock successful responses
      vi.mocked(fetch).mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ status: 'ok' })
      } as Response);

      const testScenario = {
        name: 'test-scenario',
        description: 'Test scenario',
        duration: 1000, // 1 second for testing
        concurrentUsers: 2,
        rampUpTime: 100,
        tests: [
          {
            id: 'test-1',
            name: 'Test',
            endpoint: '/api/test',
            method: 'GET',
            expectedStatus: 200,
            timeout: 1000,
            iterations: 1
          }
        ],
        userBehavior: {
          thinkTime: { min: 10, max: 50 },
          sessionDuration: { min: 500, max: 1000 },
          requestDistribution: { 'test-1': 100 }
        }
      };

      const result = await loadTester.runLoadTest(testScenario);

      expect(result).toBeDefined();
      expect(result.scenario).toBe('test-scenario');
      expect(result.concurrentUsers).toBe(2);
      expect(result.totalRequests).toBeGreaterThanOrEqual(0);
    }, 10000); // 10 second timeout for this test
  });
});

describe('RegressionDetector', () => {
  let detector: RegressionDetector;

  beforeEach(() => {
    detector = new RegressionDetector();
    vi.clearAllMocks();
  });

  describe('analyzePerformance', () => {
    it('should detect performance regressions', () => {
      const comparison = {
        baseline: {
          responseTime: 100,
          throughput: 100,
          errorRate: 0,
          memoryUsage: 100,
          cpuUsage: 50,
          functionCount: 50,
          cacheHitRate: 80,
          databaseQueryTime: 20,
          timestamp: new Date()
        },
        current: {
          responseTime: 150, // 50% increase - should trigger alert
          throughput: 80,    // 20% decrease - should trigger alert
          errorRate: 2,      // 2% increase - should trigger alert
          memoryUsage: 140,  // 40% increase - should trigger alert
          cpuUsage: 60,
          functionCount: 50,
          cacheHitRate: 65,  // 18.75% decrease - should trigger alert
          databaseQueryTime: 30, // 50% increase - should trigger alert
          timestamp: new Date()
        },
        improvements: {
          responseTime: -50,
          throughput: -20,
          errorRate: -2,
          memoryUsage: -40,
          functionCount: 0
        },
        regressions: [],
        overallScore: 30
      };

      const report = detector.analyzePerformance(comparison);

      expect(report).toBeDefined();
      expect(report.overallStatus).toBe('critical');
      expect(report.alerts.length).toBeGreaterThan(0);
      expect(report.summary.totalAlerts).toBeGreaterThan(0);
      expect(report.recommendations.length).toBeGreaterThan(0);
    });

    it('should report healthy status when no regressions', () => {
      const comparison = {
        baseline: {
          responseTime: 100,
          throughput: 100,
          errorRate: 1,
          memoryUsage: 100,
          cpuUsage: 50,
          functionCount: 50,
          cacheHitRate: 80,
          databaseQueryTime: 20,
          timestamp: new Date()
        },
        current: {
          responseTime: 90,  // 10% improvement
          throughput: 110,   // 10% improvement
          errorRate: 0.5,    // 0.5% improvement
          memoryUsage: 95,   // 5% improvement
          cpuUsage: 45,
          functionCount: 45, // 5 fewer functions
          cacheHitRate: 85,  // 6.25% improvement
          databaseQueryTime: 18, // 10% improvement
          timestamp: new Date()
        },
        improvements: {
          responseTime: 10,
          throughput: 10,
          errorRate: 0.5,
          memoryUsage: 5,
          functionCount: 5
        },
        regressions: [],
        overallScore: 85
      };

      const report = detector.analyzePerformance(comparison);

      expect(report.overallStatus).toBe('healthy');
      expect(report.alerts.length).toBe(0);
      expect(report.summary.totalAlerts).toBe(0);
    });
  });

  describe('setThresholds', () => {
    it('should update regression thresholds', () => {
      const customThresholds = [
        { metric: 'responseTime' as const, maxDegradation: 10, severity: 'critical' as const },
        { metric: 'throughput' as const, maxDegradation: 5, severity: 'high' as const }
      ];

      detector.setThresholds(customThresholds);
      const thresholds = detector.getThresholds();

      expect(thresholds).toEqual(customThresholds);
    });
  });

  describe('generateTrendAnalysis', () => {
    it('should analyze performance trends', () => {
      const historicalData: BenchmarkMetrics[] = [
        {
          responseTime: 100,
          throughput: 100,
          errorRate: 0,
          memoryUsage: 100,
          cpuUsage: 50,
          functionCount: 50,
          cacheHitRate: 80,
          databaseQueryTime: 20,
          timestamp: new Date('2024-01-01')
        },
        {
          responseTime: 110,
          throughput: 95,
          errorRate: 0.5,
          memoryUsage: 105,
          cpuUsage: 52,
          functionCount: 48,
          cacheHitRate: 82,
          databaseQueryTime: 22,
          timestamp: new Date('2024-01-02')
        },
        {
          responseTime: 120,
          throughput: 90,
          errorRate: 1,
          memoryUsage: 110,
          cpuUsage: 55,
          functionCount: 45,
          cacheHitRate: 85,
          databaseQueryTime: 25,
          timestamp: new Date('2024-01-03')
        }
      ];

      const analysis = detector.generateTrendAnalysis(historicalData);

      expect(analysis.trends).toBeDefined();
      expect(analysis.predictions).toBeDefined();
      expect(analysis.trends.responseTime).toBe('degrading');
      expect(analysis.trends.throughput).toBe('degrading');
      expect(typeof analysis.predictions.responseTime).toBe('number');
    });

    it('should handle insufficient data gracefully', () => {
      const historicalData: BenchmarkMetrics[] = [
        {
          responseTime: 100,
          throughput: 100,
          errorRate: 0,
          memoryUsage: 100,
          cpuUsage: 50,
          functionCount: 50,
          cacheHitRate: 80,
          databaseQueryTime: 20,
          timestamp: new Date()
        }
      ];

      const analysis = detector.generateTrendAnalysis(historicalData);

      expect(analysis.trends).toEqual({});
      expect(analysis.predictions).toEqual({});
    });
  });
});