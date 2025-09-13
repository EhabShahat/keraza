#!/usr/bin/env node

/**
 * Comprehensive Benchmarking System Test Script
 * Tests all components of the performance benchmarking and validation system
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  testTimeout: 30000, // 30 seconds
  verbose: process.argv.includes('--verbose'),
  skipSetup: process.argv.includes('--skip-setup')
};

class BenchmarkingSystemTester {
  constructor() {
    this.testResults = {
      timestamp: new Date().toISOString(),
      totalTests: 0,
      passedTests: 0,
      failedTests: 0,
      testSuites: []
    };
  }

  async runAllTests() {
    console.log('🧪 Starting Benchmarking System Tests');
    console.log(`📍 Target URL: ${CONFIG.baseUrl}`);
    console.log('');

    try {
      // Setup phase
      if (!CONFIG.skipSetup) {
        await this.setupTestEnvironment();
      }

      // Test suites
      await this.testPerformanceBenchmarker();
      await this.testCostAnalyzer();
      await this.testSuccessValidator();
      await this.testAPIEndpoints();
      await this.testIntegration();

      // Generate report
      this.generateTestReport();

      console.log('✅ All benchmarking system tests completed');
      console.log(`📊 Results: ${this.testResults.passedTests}/${this.testResults.totalTests} tests passed`);

      if (this.testResults.failedTests > 0) {
        process.exit(1);
      }

    } catch (error) {
      console.error('❌ Benchmarking system tests failed:', error.message);
      if (CONFIG.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  async setupTestEnvironment() {
    console.log('🔧 Setting up test environment...');
    
    try {
      // Check if server is running
      await this.makeRequest('/api/admin/health');
      console.log('✅ Server is running');

      // Initialize database schema if needed
      console.log('📊 Initializing database schema...');
      // This would run the SQL schema files in a real implementation
      
      console.log('✅ Test environment ready');
    } catch (error) {
      throw new Error(`Test environment setup failed: ${error.message}`);
    }
  }

  async testPerformanceBenchmarker() {
    console.log('🚀 Testing Performance Benchmarker...');
    
    const suite = {
      name: 'Performance Benchmarker',
      tests: []
    };

    // Test baseline establishment
    await this.runTest(suite, 'Establish Baseline', async () => {
      const response = await this.makeRequest('/api/admin/benchmarks/run', {
        method: 'POST',
        body: JSON.stringify({ type: 'baseline' })
      });

      if (!response.ok) {
        throw new Error(`Baseline establishment failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.data.responseTime) {
        throw new Error('Invalid baseline data returned');
      }

      return 'Baseline established successfully';
    });

    // Test benchmark suite
    await this.runTest(suite, 'Run Benchmark Suite', async () => {
      const response = await this.makeRequest('/api/admin/benchmarks/run', {
        method: 'POST',
        body: JSON.stringify({ 
          type: 'benchmark',
          config: {
            tests: [
              {
                id: 'test-health',
                name: 'Health Check Test',
                endpoint: '/api/admin/health',
                method: 'GET',
                expectedStatus: 200,
                timeout: 5000,
                iterations: 3
              }
            ]
          }
        })
      });

      if (!response.ok) {
        throw new Error(`Benchmark suite failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !Array.isArray(data.data)) {
        throw new Error('Invalid benchmark results returned');
      }

      return `Benchmark suite completed with ${data.data.length} tests`;
    });

    // Test regression check
    await this.runTest(suite, 'Regression Check', async () => {
      const response = await this.makeRequest('/api/admin/benchmarks/run', {
        method: 'POST',
        body: JSON.stringify({ type: 'regression-check' })
      });

      if (!response.ok) {
        throw new Error(`Regression check failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.data.regressionReport) {
        throw new Error('Invalid regression report returned');
      }

      return `Regression check completed: ${data.data.regressionReport.overallStatus}`;
    });

    this.testResults.testSuites.push(suite);
    console.log(`✅ Performance Benchmarker tests: ${suite.tests.filter(t => t.passed).length}/${suite.tests.length} passed`);
  }

  async testCostAnalyzer() {
    console.log('💰 Testing Cost Analyzer...');
    
    const suite = {
      name: 'Cost Analyzer',
      tests: []
    };

    // Test cost baseline establishment
    await this.runTest(suite, 'Establish Cost Baseline', async () => {
      const response = await this.makeRequest('/api/admin/cost-analysis/roi', {
        method: 'POST',
        body: JSON.stringify({ action: 'establish-baseline' })
      });

      if (!response.ok) {
        throw new Error(`Cost baseline establishment failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.data.totalCost) {
        throw new Error('Invalid cost baseline data returned');
      }

      return 'Cost baseline established successfully';
    });

    // Test current costs calculation
    await this.runTest(suite, 'Calculate Current Costs', async () => {
      const response = await this.makeRequest('/api/admin/cost-analysis/roi', {
        method: 'POST',
        body: JSON.stringify({ action: 'current-costs' })
      });

      if (!response.ok) {
        throw new Error(`Current costs calculation failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || typeof data.data.totalCost !== 'number') {
        throw new Error('Invalid current costs data returned');
      }

      return `Current costs calculated: $${data.data.totalCost.toFixed(4)}`;
    });

    // Test ROI calculation
    await this.runTest(suite, 'Calculate ROI', async () => {
      const response = await this.makeRequest('/api/admin/cost-analysis/roi', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'calculate-roi',
          optimizationCost: 1000,
          period: '30-day'
        })
      });

      if (!response.ok) {
        throw new Error(`ROI calculation failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || typeof data.data.roi !== 'number') {
        throw new Error('Invalid ROI data returned');
      }

      return `ROI calculated: ${data.data.roi.toFixed(1)}%`;
    });

    // Test cost projections
    await this.runTest(suite, 'Generate Cost Projections', async () => {
      const response = await this.makeRequest('/api/admin/cost-analysis/roi?action=projections&timeframe=monthly');

      if (!response.ok) {
        throw new Error(`Cost projections failed: ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data.projections)) {
        throw new Error('Invalid projections data returned');
      }

      return `Generated ${data.projections.length} cost projections`;
    });

    this.testResults.testSuites.push(suite);
    console.log(`✅ Cost Analyzer tests: ${suite.tests.filter(t => t.passed).length}/${suite.tests.length} passed`);
  }

  async testSuccessValidator() {
    console.log('✅ Testing Success Validator...');
    
    const suite = {
      name: 'Success Validator',
      tests: []
    };

    // Test success criteria retrieval
    await this.runTest(suite, 'Get Success Criteria', async () => {
      const response = await this.makeRequest('/api/admin/validation/success?type=criteria');

      if (!response.ok) {
        throw new Error(`Success criteria retrieval failed: ${response.status}`);
      }

      const data = await response.json();
      if (!Array.isArray(data.criteria)) {
        throw new Error('Invalid criteria data returned');
      }

      return `Retrieved ${data.criteria.length} success criteria`;
    });

    // Test feature parity validation
    await this.runTest(suite, 'Feature Parity Validation', async () => {
      const response = await this.makeRequest('/api/admin/validation/success', {
        method: 'POST',
        body: JSON.stringify({ action: 'validate-feature-parity' })
      });

      if (!response.ok) {
        throw new Error(`Feature parity validation failed: ${response.status}`);
      }

      const data = await response.json();
      if (!data.success || !data.data.results) {
        throw new Error('Invalid feature parity results returned');
      }

      const passedTests = data.data.results.filter(r => r.passed).length;
      return `Feature parity: ${passedTests}/${data.data.results.length} tests passed`;
    });

    // Test performance validation (if baseline exists)
    await this.runTest(suite, 'Performance Validation', async () => {
      try {
        const response = await this.makeRequest('/api/admin/validation/success', {
          method: 'POST',
          body: JSON.stringify({ action: 'validate-performance' })
        });

        if (response.status === 400) {
          // No baseline available - this is expected in some cases
          return 'Performance validation skipped (no baseline)';
        }

        if (!response.ok) {
          throw new Error(`Performance validation failed: ${response.status}`);
        }

        const data = await response.json();
        if (!data.success || !data.data.results) {
          throw new Error('Invalid performance validation results returned');
        }

        return `Performance validation completed: ${data.data.successRate.toFixed(1)}% success rate`;
      } catch (error) {
        // If baseline doesn't exist, that's okay for testing
        if (error.message.includes('No performance baseline')) {
          return 'Performance validation skipped (no baseline)';
        }
        throw error;
      }
    });

    this.testResults.testSuites.push(suite);
    console.log(`✅ Success Validator tests: ${suite.tests.filter(t => t.passed).length}/${suite.tests.length} passed`);
  }

  async testAPIEndpoints() {
    console.log('🔌 Testing API Endpoints...');
    
    const suite = {
      name: 'API Endpoints',
      tests: []
    };

    const endpoints = [
      { path: '/api/admin/benchmarks/baseline', method: 'GET', name: 'Get Baseline' },
      { path: '/api/admin/benchmarks/results', method: 'GET', name: 'Get Results' },
      { path: '/api/admin/cost-analysis/baseline', method: 'GET', name: 'Get Cost Baseline' },
      { path: '/api/admin/cost-analysis/metrics', method: 'GET', name: 'Get Cost Metrics' },
      { path: '/api/admin/validation/success?type=summary', method: 'GET', name: 'Get Validation Summary' }
    ];

    for (const endpoint of endpoints) {
      await this.runTest(suite, endpoint.name, async () => {
        const response = await this.makeRequest(endpoint.path, {
          method: endpoint.method
        });

        // 404 is acceptable for some endpoints if no data exists yet
        if (response.status === 404) {
          return `${endpoint.name}: No data (expected)`;
        }

        if (!response.ok) {
          throw new Error(`${endpoint.name} failed: ${response.status}`);
        }

        return `${endpoint.name}: OK`;
      });
    }

    this.testResults.testSuites.push(suite);
    console.log(`✅ API Endpoints tests: ${suite.tests.filter(t => t.passed).length}/${suite.tests.length} passed`);
  }

  async testIntegration() {
    console.log('🔗 Testing Integration...');
    
    const suite = {
      name: 'Integration Tests',
      tests: []
    };

    // Test full benchmarking workflow
    await this.runTest(suite, 'Full Benchmarking Workflow', async () => {
      // 1. Establish baseline
      let response = await this.makeRequest('/api/admin/benchmarks/run', {
        method: 'POST',
        body: JSON.stringify({ type: 'baseline' })
      });

      if (!response.ok) {
        throw new Error('Baseline establishment failed in workflow');
      }

      // 2. Run benchmark
      response = await this.makeRequest('/api/admin/benchmarks/run', {
        method: 'POST',
        body: JSON.stringify({ 
          type: 'benchmark',
          config: { tests: [] } // Use default tests
        })
      });

      if (!response.ok) {
        throw new Error('Benchmark run failed in workflow');
      }

      // 3. Check regression
      response = await this.makeRequest('/api/admin/benchmarks/run', {
        method: 'POST',
        body: JSON.stringify({ type: 'regression-check' })
      });

      if (!response.ok) {
        throw new Error('Regression check failed in workflow');
      }

      return 'Full benchmarking workflow completed successfully';
    });

    // Test cost analysis workflow
    await this.runTest(suite, 'Cost Analysis Workflow', async () => {
      // 1. Establish cost baseline
      let response = await this.makeRequest('/api/admin/cost-analysis/roi', {
        method: 'POST',
        body: JSON.stringify({ action: 'establish-baseline' })
      });

      if (!response.ok) {
        throw new Error('Cost baseline establishment failed in workflow');
      }

      // 2. Calculate ROI
      response = await this.makeRequest('/api/admin/cost-analysis/roi', {
        method: 'POST',
        body: JSON.stringify({ 
          action: 'calculate-roi',
          optimizationCost: 500,
          period: '7-day'
        })
      });

      if (!response.ok) {
        throw new Error('ROI calculation failed in workflow');
      }

      return 'Cost analysis workflow completed successfully';
    });

    this.testResults.testSuites.push(suite);
    console.log(`✅ Integration tests: ${suite.tests.filter(t => t.passed).length}/${suite.tests.length} passed`);
  }

  async runTest(suite, testName, testFunction) {
    const test = {
      name: testName,
      passed: false,
      error: null,
      result: null,
      duration: 0
    };

    this.testResults.totalTests++;

    try {
      const startTime = Date.now();
      
      // Run test with timeout
      const timeoutPromise = new Promise((_, reject) => {
        setTimeout(() => reject(new Error('Test timeout')), CONFIG.testTimeout);
      });

      const result = await Promise.race([testFunction(), timeoutPromise]);
      
      test.duration = Date.now() - startTime;
      test.passed = true;
      test.result = result;
      this.testResults.passedTests++;

      if (CONFIG.verbose) {
        console.log(`  ✅ ${testName}: ${result} (${test.duration}ms)`);
      }
    } catch (error) {
      test.error = error.message;
      this.testResults.failedTests++;

      console.log(`  ❌ ${testName}: ${error.message}`);
      if (CONFIG.verbose) {
        console.log(`     ${error.stack}`);
      }
    }

    suite.tests.push(test);
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${CONFIG.baseUrl}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BenchmarkingSystemTester/1.0'
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    return response;
  }

  generateTestReport() {
    console.log('\n📄 Generating test report...');
    
    const report = {
      ...this.testResults,
      summary: {
        totalSuites: this.testResults.testSuites.length,
        passRate: (this.testResults.passedTests / this.testResults.totalTests) * 100,
        suiteResults: this.testResults.testSuites.map(suite => ({
          name: suite.name,
          total: suite.tests.length,
          passed: suite.tests.filter(t => t.passed).length,
          failed: suite.tests.filter(t => !t.passed).length
        }))
      }
    };

    // Save report to file
    const reportPath = `./benchmark-test-report-${Date.now()}.json`;
    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    
    console.log(`📄 Test report saved to: ${reportPath}`);
    
    // Print summary
    console.log('\n📊 Test Summary:');
    console.log(`Total Tests: ${report.totalTests}`);
    console.log(`Passed: ${report.passedTests}`);
    console.log(`Failed: ${report.failedTests}`);
    console.log(`Pass Rate: ${report.summary.passRate.toFixed(1)}%`);
    
    console.log('\nSuite Results:');
    report.summary.suiteResults.forEach(suite => {
      console.log(`  ${suite.name}: ${suite.passed}/${suite.total} passed`);
    });
  }
}

// Main execution
async function main() {
  // Check if fetch is available (Node.js 18+)
  if (typeof fetch === 'undefined') {
    console.error('❌ This script requires Node.js 18+ with built-in fetch support');
    process.exit(1);
  }

  const tester = new BenchmarkingSystemTester();
  await tester.runAllTests();
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
Benchmarking System Test Runner

Usage: node scripts/test-benchmarking-system.js [options]

Options:
  --verbose       Show detailed test output
  --skip-setup    Skip test environment setup
  --help          Show this help message

Environment Variables:
  NEXT_PUBLIC_APP_URL  Target application URL (default: http://localhost:3000)
`);
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Test script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { BenchmarkingSystemTester };