#!/usr/bin/env node

/**
 * Performance Benchmarking Script
 * Runs comprehensive performance tests and generates reports
 */

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Configuration
const CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  outputDir: './benchmark-reports',
  scenarios: ['exam-taking', 'admin-management', 'public-access'],
  iterations: 3,
  verbose: process.argv.includes('--verbose'),
  skipBaseline: process.argv.includes('--skip-baseline'),
  onlyRegression: process.argv.includes('--regression-only')
};

class BenchmarkRunner {
  constructor() {
    this.results = {
      timestamp: new Date().toISOString(),
      baseline: null,
      benchmarks: [],
      loadTests: [],
      regressions: null,
      summary: {}
    };
  }

  async run() {
    console.log('🚀 Starting Performance Benchmark Suite');
    console.log(`📍 Target URL: ${CONFIG.baseUrl}`);
    console.log(`📊 Scenarios: ${CONFIG.scenarios.join(', ')}`);
    console.log(`🔄 Iterations: ${CONFIG.iterations}`);
    console.log('');

    try {
      // Ensure output directory exists
      this.ensureOutputDir();

      // Check if server is running
      await this.checkServerHealth();

      if (!CONFIG.onlyRegression) {
        // Establish baseline if needed
        if (!CONFIG.skipBaseline) {
          await this.establishBaseline();
        }

        // Run benchmark tests
        await this.runBenchmarkTests();

        // Run load tests
        await this.runLoadTests();
      }

      // Run regression analysis
      await this.runRegressionAnalysis();

      // Generate reports
      await this.generateReports();

      console.log('✅ Benchmark suite completed successfully');
      console.log(`📄 Reports saved to: ${CONFIG.outputDir}`);

    } catch (error) {
      console.error('❌ Benchmark suite failed:', error.message);
      if (CONFIG.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  ensureOutputDir() {
    if (!fs.existsSync(CONFIG.outputDir)) {
      fs.mkdirSync(CONFIG.outputDir, { recursive: true });
    }
  }

  async checkServerHealth() {
    console.log('🔍 Checking server health...');
    
    try {
      const response = await this.makeRequest('/api/admin/health');
      if (!response.ok) {
        throw new Error(`Server health check failed: ${response.status}`);
      }
      console.log('✅ Server is healthy');
    } catch (error) {
      throw new Error(`Cannot connect to server at ${CONFIG.baseUrl}: ${error.message}`);
    }
  }

  async establishBaseline() {
    console.log('📊 Establishing performance baseline...');
    
    try {
      const response = await this.makeRequest('/api/admin/benchmarks/run', {
        method: 'POST',
        body: JSON.stringify({ type: 'baseline' })
      });

      if (!response.ok) {
        throw new Error(`Baseline establishment failed: ${response.status}`);
      }

      const result = await response.json();
      this.results.baseline = result.data;
      
      console.log('✅ Baseline established');
      if (CONFIG.verbose) {
        console.log('   Response Time:', `${result.data.responseTime.toFixed(2)}ms`);
        console.log('   Throughput:', `${result.data.throughput.toFixed(2)} req/s`);
        console.log('   Function Count:', result.data.functionCount);
      }
    } catch (error) {
      throw new Error(`Failed to establish baseline: ${error.message}`);
    }
  }

  async runBenchmarkTests() {
    console.log('🧪 Running benchmark tests...');
    
    const defaultTests = [
      {
        id: 'admin-health',
        name: 'Admin Health Check',
        endpoint: '/api/admin/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        iterations: 20
      },
      {
        id: 'public-health',
        name: 'Public Health Check',
        endpoint: '/api/public/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        iterations: 20
      },
      {
        id: 'attempts-health',
        name: 'Attempts Health Check',
        endpoint: '/api/attempts/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        iterations: 20
      },
      {
        id: 'monitoring-status',
        name: 'Monitoring Status',
        endpoint: '/api/admin/monitoring/status',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        iterations: 10
      }
    ];

    for (let i = 0; i < CONFIG.iterations; i++) {
      console.log(`   Iteration ${i + 1}/${CONFIG.iterations}`);
      
      try {
        const response = await this.makeRequest('/api/admin/benchmarks/run', {
          method: 'POST',
          body: JSON.stringify({
            type: 'benchmark',
            config: { tests: defaultTests }
          })
        });

        if (!response.ok) {
          throw new Error(`Benchmark test failed: ${response.status}`);
        }

        const result = await response.json();
        this.results.benchmarks.push({
          iteration: i + 1,
          timestamp: new Date().toISOString(),
          results: result.data
        });

        if (CONFIG.verbose) {
          console.log(`     Completed ${result.data.length} tests`);
        }
      } catch (error) {
        console.warn(`   ⚠️ Iteration ${i + 1} failed:`, error.message);
      }

      // Brief pause between iterations
      if (i < CONFIG.iterations - 1) {
        await this.sleep(2000);
      }
    }

    console.log('✅ Benchmark tests completed');
  }

  async runLoadTests() {
    console.log('🚛 Running load tests...');
    
    for (const scenario of CONFIG.scenarios) {
      console.log(`   Running scenario: ${scenario}`);
      
      try {
        const response = await this.makeRequest('/api/admin/benchmarks/run', {
          method: 'POST',
          body: JSON.stringify({
            type: 'load-test',
            config: { scenario }
          })
        });

        if (!response.ok) {
          throw new Error(`Load test failed: ${response.status}`);
        }

        const result = await response.json();
        this.results.loadTests.push({
          scenario,
          timestamp: new Date().toISOString(),
          result: result.data
        });

        if (CONFIG.verbose) {
          console.log(`     Throughput: ${result.data.throughput.toFixed(2)} req/s`);
          console.log(`     Error Rate: ${result.data.errorRate.toFixed(2)}%`);
        }
      } catch (error) {
        console.warn(`   ⚠️ Load test ${scenario} failed:`, error.message);
      }

      // Pause between load tests to avoid overwhelming the system
      await this.sleep(5000);
    }

    console.log('✅ Load tests completed');
  }

  async runRegressionAnalysis() {
    console.log('🔍 Running regression analysis...');
    
    try {
      const response = await this.makeRequest('/api/admin/benchmarks/run', {
        method: 'POST',
        body: JSON.stringify({ type: 'regression-check' })
      });

      if (!response.ok) {
        throw new Error(`Regression analysis failed: ${response.status}`);
      }

      const result = await response.json();
      this.results.regressions = result.data;
      
      const { regressionReport } = result.data;
      console.log(`✅ Regression analysis completed: ${regressionReport.overallStatus} status`);
      
      if (regressionReport.alerts.length > 0) {
        console.log(`⚠️ Found ${regressionReport.alerts.length} performance alerts:`);
        regressionReport.alerts.forEach(alert => {
          const icon = alert.severity === 'critical' ? '🚨' : 
                      alert.severity === 'high' ? '⚠️' : 
                      alert.severity === 'medium' ? '⚡' : 'ℹ️';
          console.log(`   ${icon} ${alert.message}`);
        });
      }

      if (CONFIG.verbose && regressionReport.recommendations.length > 0) {
        console.log('💡 Recommendations:');
        regressionReport.recommendations.forEach(rec => {
          console.log(`   • ${rec}`);
        });
      }
    } catch (error) {
      console.warn('⚠️ Regression analysis failed:', error.message);
    }
  }

  async generateReports() {
    console.log('📄 Generating reports...');
    
    // Calculate summary statistics
    this.calculateSummary();
    
    // Generate JSON report
    const jsonReport = path.join(CONFIG.outputDir, `benchmark-report-${Date.now()}.json`);
    fs.writeFileSync(jsonReport, JSON.stringify(this.results, null, 2));
    
    // Generate HTML report
    const htmlReport = path.join(CONFIG.outputDir, `benchmark-report-${Date.now()}.html`);
    fs.writeFileSync(htmlReport, this.generateHtmlReport());
    
    // Generate CSV summary
    const csvReport = path.join(CONFIG.outputDir, `benchmark-summary-${Date.now()}.csv`);
    fs.writeFileSync(csvReport, this.generateCsvReport());
    
    console.log('✅ Reports generated');
  }

  calculateSummary() {
    const summary = {
      totalTests: 0,
      successfulTests: 0,
      failedTests: 0,
      averageResponseTime: 0,
      averageThroughput: 0,
      averageErrorRate: 0,
      performanceScore: 0
    };

    // Aggregate benchmark results
    const allResults = this.results.benchmarks.flatMap(b => b.results);
    summary.totalTests = allResults.length;
    summary.successfulTests = allResults.filter(r => r.success).length;
    summary.failedTests = allResults.filter(r => !r.success).length;

    if (allResults.length > 0) {
      summary.averageResponseTime = allResults.reduce((sum, r) => sum + r.metrics.responseTime, 0) / allResults.length;
      summary.averageThroughput = allResults.reduce((sum, r) => sum + r.metrics.throughput, 0) / allResults.length;
      summary.averageErrorRate = allResults.reduce((sum, r) => sum + r.metrics.errorRate, 0) / allResults.length;
    }

    // Calculate performance score
    if (this.results.regressions?.comparison) {
      summary.performanceScore = this.results.regressions.comparison.overallScore;
    }

    this.results.summary = summary;
  }

  generateHtmlReport() {
    const { summary, regressions } = this.results;
    
    return `
<!DOCTYPE html>
<html>
<head>
    <title>Performance Benchmark Report</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .metric { display: inline-block; margin: 10px; padding: 10px; background: #e9e9e9; border-radius: 3px; }
        .alert { padding: 10px; margin: 5px 0; border-radius: 3px; }
        .critical { background: #ffebee; border-left: 4px solid #f44336; }
        .high { background: #fff3e0; border-left: 4px solid #ff9800; }
        .medium { background: #f3e5f5; border-left: 4px solid #9c27b0; }
        .low { background: #e8f5e8; border-left: 4px solid #4caf50; }
        table { width: 100%; border-collapse: collapse; margin: 20px 0; }
        th, td { padding: 10px; text-align: left; border-bottom: 1px solid #ddd; }
        th { background: #f5f5f5; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Performance Benchmark Report</h1>
        <p>Generated: ${this.results.timestamp}</p>
        <p>Target: ${CONFIG.baseUrl}</p>
    </div>

    <h2>Summary</h2>
    <div class="metric">Total Tests: ${summary.totalTests}</div>
    <div class="metric">Success Rate: ${((summary.successfulTests / summary.totalTests) * 100).toFixed(1)}%</div>
    <div class="metric">Avg Response Time: ${summary.averageResponseTime.toFixed(2)}ms</div>
    <div class="metric">Avg Throughput: ${summary.averageThroughput.toFixed(2)} req/s</div>
    <div class="metric">Performance Score: ${summary.performanceScore.toFixed(1)}/100</div>

    ${regressions?.regressionReport?.alerts?.length > 0 ? `
    <h2>Performance Alerts</h2>
    ${regressions.regressionReport.alerts.map(alert => `
        <div class="alert ${alert.severity}">
            <strong>${alert.severity.toUpperCase()}:</strong> ${alert.message}
        </div>
    `).join('')}
    ` : ''}

    ${regressions?.regressionReport?.recommendations?.length > 0 ? `
    <h2>Recommendations</h2>
    <ul>
        ${regressions.regressionReport.recommendations.map(rec => `<li>${rec}</li>`).join('')}
    </ul>
    ` : ''}

    <h2>Load Test Results</h2>
    <table>
        <tr>
            <th>Scenario</th>
            <th>Throughput (req/s)</th>
            <th>Avg Response Time (ms)</th>
            <th>Error Rate (%)</th>
            <th>Concurrent Users</th>
        </tr>
        ${this.results.loadTests.map(test => `
            <tr>
                <td>${test.scenario}</td>
                <td>${test.result.throughput.toFixed(2)}</td>
                <td>${test.result.averageResponseTime.toFixed(2)}</td>
                <td>${test.result.errorRate.toFixed(2)}</td>
                <td>${test.result.concurrentUsers}</td>
            </tr>
        `).join('')}
    </table>
</body>
</html>`;
  }

  generateCsvReport() {
    const rows = [
      'Metric,Value',
      `Total Tests,${this.results.summary.totalTests}`,
      `Successful Tests,${this.results.summary.successfulTests}`,
      `Failed Tests,${this.results.summary.failedTests}`,
      `Average Response Time (ms),${this.results.summary.averageResponseTime.toFixed(2)}`,
      `Average Throughput (req/s),${this.results.summary.averageThroughput.toFixed(2)}`,
      `Average Error Rate (%),${this.results.summary.averageErrorRate.toFixed(2)}`,
      `Performance Score,${this.results.summary.performanceScore.toFixed(1)}`
    ];

    return rows.join('\n');
  }

  async makeRequest(endpoint, options = {}) {
    const url = `${CONFIG.baseUrl}${endpoint}`;
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'BenchmarkRunner/1.0'
      }
    };

    const response = await fetch(url, { ...defaultOptions, ...options });
    return response;
  }

  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

// Main execution
async function main() {
  // Check if fetch is available (Node.js 18+)
  if (typeof fetch === 'undefined') {
    console.error('❌ This script requires Node.js 18+ with built-in fetch support');
    process.exit(1);
  }

  const runner = new BenchmarkRunner();
  await runner.run();
}

// Handle command line arguments
if (process.argv.includes('--help')) {
  console.log(`
Performance Benchmark Runner

Usage: node scripts/run-performance-benchmarks.js [options]

Options:
  --verbose           Show detailed output
  --skip-baseline     Skip baseline establishment
  --regression-only   Only run regression analysis
  --help             Show this help message

Environment Variables:
  NEXT_PUBLIC_APP_URL  Target application URL (default: http://localhost:3000)
`);
  process.exit(0);
}

// Run the script
if (require.main === module) {
  main().catch(error => {
    console.error('❌ Script failed:', error.message);
    process.exit(1);
  });
}

module.exports = { BenchmarkRunner };