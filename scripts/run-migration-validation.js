#!/usr/bin/env node

/**
 * Migration Validation Test Runner
 * 
 * Command-line tool for running migration validation tests
 * and generating comprehensive reports.
 */

const fs = require('fs');
const path = require('path');

class MigrationValidationRunner {
  constructor() {
    this.baseUrl = process.env.VALIDATION_BASE_URL || 'http://localhost:3000';
    this.outputDir = process.env.VALIDATION_OUTPUT_DIR || './validation-reports';
    this.verbose = process.env.VALIDATION_VERBOSE === 'true';
  }

  /**
   * Main entry point
   */
  async run() {
    const args = process.argv.slice(2);
    const command = args[0];

    try {
      switch (command) {
        case 'list-suites':
          await this.listSuites();
          break;
        case 'run-suite':
          await this.runSuite(args[1], args[2]);
          break;
        case 'run-all':
          await this.runAllSuites(args[1]);
          break;
        case 'run-consolidated':
          await this.runConsolidatedFunctionsTest(args[1]);
          break;
        case 'run-performance':
          await this.runPerformanceTest(args[1]);
          break;
        case 'run-load':
          await this.runLoadTest(args[1]);
          break;
        case 'run-parity':
          await this.runFeatureParityTest(args[1]);
          break;
        case 'status':
          await this.getStatus();
          break;
        case 'report':
          await this.generateReport(args[1]);
          break;
        case 'help':
        default:
          this.showHelp();
          break;
      }
    } catch (error) {
      console.error('❌ Error:', error.message);
      if (this.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  /**
   * List available validation suites
   */
  async listSuites() {
    console.log('📋 Fetching available validation suites...');
    
    const response = await this.makeRequest('/api/admin/validation?action=suites');
    const { suites } = response;

    console.log('\n🧪 Available Validation Suites:');
    console.log('================================');
    
    suites.forEach(suite => {
      console.log(`\n📦 ${suite.name} (${suite.id})`);
      console.log(`   Description: ${suite.description}`);
      console.log(`   Categories: ${suite.test_categories.length}`);
      console.log(`   Parallel: ${suite.parallel_execution ? 'Yes' : 'No'}`);
      console.log(`   Timeout: ${suite.timeout / 1000}s`);
      
      suite.test_categories.forEach(category => {
        console.log(`   - ${category.name}: ${category.tests.length} tests`);
      });
    });
  }

  /**
   * Run specific validation suite
   */
  async runSuite(suiteId, environment = 'both') {
    if (!suiteId) {
      throw new Error('Suite ID is required. Use "list-suites" to see available suites.');
    }

    console.log(`🚀 Starting validation suite: ${suiteId}`);
    console.log(`🌍 Environment: ${environment}`);
    
    const response = await this.makeRequest('/api/admin/validation', 'POST', {
      action: 'run_suite',
      suite_id: suiteId,
      environment
    });

    const { execution_id } = response;
    console.log(`📊 Execution ID: ${execution_id}`);
    
    // Monitor execution
    await this.monitorExecution(execution_id);
  }

  /**
   * Run all validation suites
   */
  async runAllSuites(environment = 'both') {
    console.log('🚀 Running all validation suites...');
    
    const suitesResponse = await this.makeRequest('/api/admin/validation?action=suites');
    const { suites } = suitesResponse;

    const results = [];
    
    for (const suite of suites) {
      console.log(`\n📦 Running suite: ${suite.name}`);
      
      try {
        const response = await this.makeRequest('/api/admin/validation', 'POST', {
          action: 'run_suite',
          suite_id: suite.id,
          environment
        });

        const { execution_id } = response;
        const result = await this.monitorExecution(execution_id);
        results.push({ suite: suite.name, result });
        
      } catch (error) {
        console.error(`❌ Suite ${suite.name} failed:`, error.message);
        results.push({ suite: suite.name, error: error.message });
      }
    }

    // Generate summary report
    await this.generateSummaryReport(results);
  }

  /**
   * Run consolidated functions test
   */
  async runConsolidatedFunctionsTest(environment = 'both') {
    console.log('🔧 Running consolidated functions validation...');
    
    const response = await this.makeRequest('/api/admin/validation', 'POST', {
      action: 'run_consolidated_functions_test',
      environment
    });

    const { execution_id } = response;
    await this.monitorExecution(execution_id);
  }

  /**
   * Run performance test
   */
  async runPerformanceTest(environment = 'both') {
    console.log('⚡ Running performance validation...');
    
    const response = await this.makeRequest('/api/admin/validation', 'POST', {
      action: 'run_performance_test',
      environment
    });

    const { execution_id } = response;
    await this.monitorExecution(execution_id);
  }

  /**
   * Run load test
   */
  async runLoadTest(environment = 'both') {
    console.log('🏋️ Running load testing...');
    
    const response = await this.makeRequest('/api/admin/validation', 'POST', {
      action: 'run_load_test',
      environment
    });

    const { execution_id } = response;
    await this.monitorExecution(execution_id);
  }

  /**
   * Run feature parity test
   */
  async runFeatureParityTest(environment = 'both') {
    console.log('🔍 Running feature parity validation...');
    
    const response = await this.makeRequest('/api/admin/validation', 'POST', {
      action: 'run_feature_parity_test',
      environment
    });

    const { execution_id } = response;
    await this.monitorExecution(execution_id);
  }

  /**
   * Monitor execution progress
   */
  async monitorExecution(executionId) {
    console.log('⏳ Monitoring execution progress...\n');
    
    let execution;
    let lastStatus = '';
    
    while (true) {
      try {
        const response = await this.makeRequest(`/api/admin/validation?action=execution&execution_id=${executionId}`);
        execution = response.execution;
        
        if (execution.status !== lastStatus) {
          console.log(`📊 Status: ${execution.status.toUpperCase()}`);
          lastStatus = execution.status;
        }

        if (execution.status === 'completed' || execution.status === 'failed' || execution.status === 'cancelled') {
          break;
        }

        // Show progress
        if (this.verbose && execution.results.length > 0) {
          const completed = execution.results.filter(r => r.status !== 'pending' && r.status !== 'running').length;
          const total = execution.results.length;
          console.log(`   Progress: ${completed}/${total} tests completed`);
        }

        await this.sleep(5000); // Check every 5 seconds
        
      } catch (error) {
        console.error('❌ Error monitoring execution:', error.message);
        break;
      }
    }

    // Display final results
    await this.displayExecutionResults(execution);
    
    // Generate detailed report
    await this.generateExecutionReport(execution);
    
    return execution;
  }

  /**
   * Display execution results
   */
  async displayExecutionResults(execution) {
    console.log('\n📊 Execution Results');
    console.log('===================');
    
    const summary = execution.summary;
    
    console.log(`Status: ${execution.status.toUpperCase()}`);
    console.log(`Duration: ${(summary.execution_time / 1000).toFixed(2)}s`);
    console.log(`Success Rate: ${summary.success_rate}%`);
    
    if (summary.performance_score > 0) {
      console.log(`Performance Score: ${summary.performance_score}%`);
    }
    
    if (summary.load_test_score > 0) {
      console.log(`Load Test Score: ${summary.load_test_score}%`);
    }

    console.log('\nTest Results:');
    console.log(`✅ Passed: ${summary.passed_tests}`);
    console.log(`❌ Failed: ${summary.failed_tests}`);
    console.log(`⚠️  Skipped: ${summary.skipped_tests}`);
    console.log(`💥 Errors: ${summary.error_tests}`);
    
    if (summary.critical_failures > 0) {
      console.log(`🚨 Critical Failures: ${summary.critical_failures}`);
    }

    // Show failed tests
    const failedTests = execution.results.filter(r => r.status === 'failed' || r.status === 'error');
    if (failedTests.length > 0) {
      console.log('\n❌ Failed Tests:');
      failedTests.forEach(test => {
        console.log(`   - ${test.test_id}: ${test.error || 'Unknown error'}`);
      });
    }

    // Show performance issues
    const performanceIssues = execution.results.filter(r => 
      r.performance_metrics && r.performance_metrics.response_time > 2000
    );
    
    if (performanceIssues.length > 0) {
      console.log('\n⚡ Performance Issues:');
      performanceIssues.forEach(test => {
        console.log(`   - ${test.test_id}: ${test.performance_metrics.response_time}ms response time`);
      });
    }
  }

  /**
   * Get validation status
   */
  async getStatus() {
    console.log('📊 Getting validation status...');
    
    const response = await this.makeRequest('/api/admin/validation?action=status');
    
    console.log('\n🧪 Validation System Status');
    console.log('===========================');
    console.log(`Available Suites: ${response.available_suites}`);
    console.log(`Recent Executions: ${response.recent_executions.length}`);
    
    if (response.recent_executions.length > 0) {
      console.log('\nRecent Executions:');
      response.recent_executions.forEach(exec => {
        const duration = exec.end_time 
          ? new Date(exec.end_time).getTime() - new Date(exec.start_time).getTime()
          : Date.now() - new Date(exec.start_time).getTime();
        
        console.log(`   - ${exec.id}: ${exec.status} (${(duration / 1000).toFixed(2)}s)`);
      });
    }
  }

  /**
   * Generate execution report
   */
  async generateExecutionReport(execution) {
    if (!fs.existsSync(this.outputDir)) {
      fs.mkdirSync(this.outputDir, { recursive: true });
    }

    const reportPath = path.join(this.outputDir, `execution-${execution.id}.json`);
    
    const report = {
      execution_id: execution.id,
      suite_id: execution.suite_id,
      environment: execution.environment,
      start_time: execution.start_time,
      end_time: execution.end_time,
      status: execution.status,
      summary: execution.summary,
      results: execution.results,
      generated_at: new Date().toISOString()
    };

    fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));
    console.log(`\n📄 Detailed report saved: ${reportPath}`);

    // Generate HTML report
    await this.generateHtmlReport(execution, report);
  }

  /**
   * Generate HTML report
   */
  async generateHtmlReport(execution, report) {
    const htmlPath = path.join(this.outputDir, `execution-${execution.id}.html`);
    
    const html = `
<!DOCTYPE html>
<html>
<head>
    <title>Validation Report - ${execution.id}</title>
    <style>
        body { font-family: Arial, sans-serif; margin: 20px; }
        .header { background: #f5f5f5; padding: 20px; border-radius: 5px; }
        .summary { display: flex; gap: 20px; margin: 20px 0; }
        .metric { background: #e8f4fd; padding: 15px; border-radius: 5px; text-align: center; }
        .metric h3 { margin: 0; color: #1976d2; }
        .metric p { margin: 5px 0 0 0; font-size: 24px; font-weight: bold; }
        .results { margin: 20px 0; }
        .test-result { margin: 10px 0; padding: 10px; border-radius: 5px; }
        .passed { background: #e8f5e8; border-left: 4px solid #4caf50; }
        .failed { background: #ffeaea; border-left: 4px solid #f44336; }
        .skipped { background: #fff3e0; border-left: 4px solid #ff9800; }
        .error { background: #fce4ec; border-left: 4px solid #e91e63; }
        .performance { margin: 10px 0; }
        .performance-good { color: #4caf50; }
        .performance-warning { color: #ff9800; }
        .performance-bad { color: #f44336; }
    </style>
</head>
<body>
    <div class="header">
        <h1>Migration Validation Report</h1>
        <p><strong>Execution ID:</strong> ${execution.id}</p>
        <p><strong>Suite:</strong> ${execution.suite_id}</p>
        <p><strong>Environment:</strong> ${execution.environment}</p>
        <p><strong>Status:</strong> ${execution.status.toUpperCase()}</p>
        <p><strong>Duration:</strong> ${(execution.summary.execution_time / 1000).toFixed(2)}s</p>
    </div>

    <div class="summary">
        <div class="metric">
            <h3>Success Rate</h3>
            <p>${execution.summary.success_rate}%</p>
        </div>
        <div class="metric">
            <h3>Tests Passed</h3>
            <p>${execution.summary.passed_tests}</p>
        </div>
        <div class="metric">
            <h3>Tests Failed</h3>
            <p>${execution.summary.failed_tests}</p>
        </div>
        <div class="metric">
            <h3>Performance Score</h3>
            <p>${execution.summary.performance_score}%</p>
        </div>
    </div>

    <div class="results">
        <h2>Test Results</h2>
        ${execution.results.map(result => `
            <div class="test-result ${result.status}">
                <h4>${result.test_id}</h4>
                <p><strong>Status:</strong> ${result.status.toUpperCase()}</p>
                <p><strong>Response Time:</strong> ${result.response_time}ms</p>
                ${result.error ? `<p><strong>Error:</strong> ${result.error}</p>` : ''}
                ${result.performance_metrics ? `
                    <div class="performance">
                        <strong>Performance Metrics:</strong>
                        <ul>
                            <li>Response Time: ${result.performance_metrics.response_time}ms</li>
                            <li>Throughput: ${result.performance_metrics.throughput} rps</li>
                            <li>Error Rate: ${(result.performance_metrics.error_rate * 100).toFixed(2)}%</li>
                        </ul>
                    </div>
                ` : ''}
            </div>
        `).join('')}
    </div>

    <div class="footer">
        <p><em>Generated at: ${new Date().toISOString()}</em></p>
    </div>
</body>
</html>`;

    fs.writeFileSync(htmlPath, html);
    console.log(`📄 HTML report saved: ${htmlPath}`);
  }

  /**
   * Generate summary report for multiple suites
   */
  async generateSummaryReport(results) {
    const reportPath = path.join(this.outputDir, `summary-${Date.now()}.json`);
    
    const summary = {
      total_suites: results.length,
      successful_suites: results.filter(r => r.result && r.result.status === 'completed').length,
      failed_suites: results.filter(r => r.error || (r.result && r.result.status === 'failed')).length,
      results,
      generated_at: new Date().toISOString()
    };

    fs.writeFileSync(reportPath, JSON.stringify(summary, null, 2));
    
    console.log('\n📊 Summary Report');
    console.log('================');
    console.log(`Total Suites: ${summary.total_suites}`);
    console.log(`Successful: ${summary.successful_suites}`);
    console.log(`Failed: ${summary.failed_suites}`);
    console.log(`Report saved: ${reportPath}`);
  }

  /**
   * Generate report for specific execution
   */
  async generateReport(executionId) {
    if (!executionId) {
      throw new Error('Execution ID is required');
    }

    console.log(`📄 Generating report for execution: ${executionId}`);
    
    const response = await this.makeRequest(`/api/admin/validation?action=execution&execution_id=${executionId}`);
    const execution = response.execution;

    await this.generateExecutionReport(execution);
  }

  /**
   * Make HTTP request
   */
  async makeRequest(endpoint, method = 'GET', body = null) {
    const url = `${this.baseUrl}${endpoint}`;
    
    const options = {
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };

    if (body) {
      options.body = JSON.stringify(body);
    }

    if (this.verbose) {
      console.log(`🌐 ${method} ${url}`);
    }

    const response = await fetch(url, options);
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`HTTP ${response.status}: ${errorText}`);
    }

    return await response.json();
  }

  /**
   * Sleep for specified milliseconds
   */
  sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Show help information
   */
  showHelp() {
    console.log(`
🧪 Migration Validation Test Runner

Usage: node run-migration-validation.js <command> [options]

Commands:
  list-suites                    List available validation suites
  run-suite <suite-id> [env]     Run specific validation suite
  run-all [env]                  Run all validation suites
  run-consolidated [env]         Run consolidated functions test
  run-performance [env]          Run performance validation
  run-load [env]                 Run load testing
  run-parity [env]               Run feature parity validation
  status                         Show validation system status
  report <execution-id>          Generate report for execution
  help                           Show this help message

Environment Options:
  blue                           Test blue environment only
  green                          Test green environment only
  both                           Test both environments (default)

Environment Variables:
  VALIDATION_BASE_URL            Base URL for API calls (default: http://localhost:3000)
  VALIDATION_OUTPUT_DIR          Output directory for reports (default: ./validation-reports)
  VALIDATION_VERBOSE             Enable verbose logging (default: false)

Examples:
  node run-migration-validation.js list-suites
  node run-migration-validation.js run-suite consolidated-functions blue
  node run-migration-validation.js run-all both
  node run-migration-validation.js status
`);
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new MigrationValidationRunner();
  runner.run().catch(error => {
    console.error('❌ Fatal error:', error.message);
    process.exit(1);
  });
}

module.exports = MigrationValidationRunner;