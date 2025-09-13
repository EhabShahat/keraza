#!/usr/bin/env node

/**
 * Database Monitoring Test Script
 * Tests all aspects of the database performance monitoring system
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
};

class DatabaseMonitoringTester {
  constructor() {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.testResults = [];
  }

  /**
   * Run comprehensive monitoring tests
   */
  async runTests() {
    console.log('🧪 Starting database monitoring tests...\n');

    const tests = [
      { name: 'Performance Metrics Logging', fn: () => this.testPerformanceMetrics() },
      { name: 'Query Performance Logging', fn: () => this.testQueryPerformanceLogging() },
      { name: 'Alert System', fn: () => this.testAlertSystem() },
      { name: 'Health Summary Function', fn: () => this.testHealthSummary() },
      { name: 'Slow Queries Analysis', fn: () => this.testSlowQueriesAnalysis() },
      { name: 'Connection Pool Metrics', fn: () => this.testConnectionPoolMetrics() },
      { name: 'Monitoring Views', fn: () => this.testMonitoringViews() },
      { name: 'Tuning Recommendations', fn: () => this.testTuningRecommendations() }
    ];

    for (const test of tests) {
      try {
        console.log(`🔍 Testing: ${test.name}...`);
        await test.fn();
        this.testResults.push({ name: test.name, status: 'PASS', error: null });
        console.log(`✅ ${test.name}: PASSED\n`);
      } catch (error) {
        this.testResults.push({ name: test.name, status: 'FAIL', error: error.message });
        console.log(`❌ ${test.name}: FAILED - ${error.message}\n`);
      }
    }

    this.displayResults();
  }

  /**
   * Test performance metrics logging
   */
  async testPerformanceMetrics() {
    // Test recording a performance metric
    const { error } = await this.supabase.rpc('record_performance_metric', {
      p_metric_type: 'test',
      p_metric_name: 'test_metric',
      p_metric_value: 123.45,
      p_metadata: { test: true, timestamp: new Date().toISOString() }
    });

    if (error) throw error;

    // Verify the metric was recorded
    const { data, error: selectError } = await this.supabase
      .from('performance_metrics')
      .select('*')
      .eq('metric_type', 'test')
      .eq('metric_name', 'test_metric')
      .order('created_at', { ascending: false })
      .limit(1);

    if (selectError) throw selectError;
    if (!data || data.length === 0) throw new Error('Metric not found');
    if (data[0].metric_value !== 123.45) throw new Error('Metric value mismatch');

    console.log('   📊 Performance metric logged successfully');
  }

  /**
   * Test query performance logging
   */
  async testQueryPerformanceLogging() {
    const testHash = 'test_hash_' + Date.now();
    const testPattern = 'SELECT * FROM test_table WHERE id = $1';

    // Test logging a query performance record
    const { error } = await this.supabase.rpc('log_query_performance', {
      p_query_hash: testHash,
      p_query_pattern: testPattern,
      p_execution_time_ms: 250,
      p_row_count: 5,
      p_success: true,
      p_session_id: 'test_session'
    });

    if (error) throw error;

    // Verify the record was logged
    const { data, error: selectError } = await this.supabase
      .from('query_performance_log')
      .select('*')
      .eq('query_hash', testHash)
      .limit(1);

    if (selectError) throw selectError;
    if (!data || data.length === 0) throw new Error('Query performance record not found');
    if (data[0].execution_time_ms !== 250) throw new Error('Execution time mismatch');

    console.log('   🔍 Query performance logged successfully');
  }

  /**
   * Test alert system
   */
  async testAlertSystem() {
    // Test creating an alert
    const { data, error } = await this.supabase.rpc('create_database_alert', {
      p_alert_type: 'test',
      p_severity: 'medium',
      p_title: 'Test Alert',
      p_message: 'This is a test alert for monitoring validation',
      p_metadata: { test: true, created_by: 'test_script' }
    });

    if (error) throw error;
    if (!data) throw new Error('Alert ID not returned');

    // Verify the alert was created
    const { data: alertData, error: selectError } = await this.supabase
      .from('database_alerts')
      .select('*')
      .eq('id', data)
      .limit(1);

    if (selectError) throw selectError;
    if (!alertData || alertData.length === 0) throw new Error('Alert not found');
    if (alertData[0].title !== 'Test Alert') throw new Error('Alert title mismatch');

    console.log('   🚨 Alert system working correctly');
  }

  /**
   * Test health summary function
   */
  async testHealthSummary() {
    // Generate some test data first
    await this.generateTestQueryData();

    // Test health summary function
    const { data, error } = await this.supabase.rpc('get_database_health_summary', {
      p_time_window_minutes: 60
    });

    if (error) throw error;
    if (!data || data.length === 0) throw new Error('No health summary data returned');

    const summary = data[0];
    if (typeof summary.total_queries !== 'string') throw new Error('Invalid total_queries type');
    if (typeof summary.avg_response_time !== 'string') throw new Error('Invalid avg_response_time type');

    console.log('   📈 Health summary function working correctly');
    console.log(`      Total queries: ${summary.total_queries}`);
    console.log(`      Avg response time: ${summary.avg_response_time}ms`);
  }

  /**
   * Test slow queries analysis
   */
  async testSlowQueriesAnalysis() {
    // Generate some slow query test data
    await this.generateSlowQueryData();

    // Test slow queries analysis function
    const { data, error } = await this.supabase.rpc('get_slow_queries_analysis', {
      p_time_window_minutes: 60,
      p_limit: 5
    });

    if (error) throw error;
    // Note: data might be empty if no slow queries exist, which is okay

    console.log('   🐌 Slow queries analysis function working correctly');
    console.log(`      Found ${data?.length || 0} slow query patterns`);
  }

  /**
   * Test connection pool metrics
   */
  async testConnectionPoolMetrics() {
    // Insert test connection pool data
    const { error } = await this.supabase
      .from('connection_pool_metrics')
      .insert({
        active_connections: 5,
        idle_connections: 3,
        total_connections: 8,
        max_connections: 10,
        utilization_percent: 80.0,
        wait_count: 2,
        wait_time_ms: 150
      });

    if (error) throw error;

    // Verify data was inserted
    const { data, error: selectError } = await this.supabase
      .from('connection_pool_metrics')
      .select('*')
      .order('timestamp', { ascending: false })
      .limit(1);

    if (selectError) throw selectError;
    if (!data || data.length === 0) throw new Error('Connection pool metrics not found');

    console.log('   🔗 Connection pool metrics working correctly');
  }

  /**
   * Test monitoring views
   */
  async testMonitoringViews() {
    const views = [
      'recent_performance_summary',
      'top_slow_queries',
      'active_alerts_summary',
      'connection_pool_trends'
    ];

    for (const view of views) {
      const { data, error } = await this.supabase
        .from(view)
        .select('*')
        .limit(1);

      if (error) throw error;
      // Views might return empty data, which is okay
      console.log(`      ✓ View '${view}' accessible`);
    }

    console.log('   👁️ All monitoring views working correctly');
  }

  /**
   * Test tuning recommendations
   */
  async testTuningRecommendations() {
    // Insert test recommendation
    const { error } = await this.supabase
      .from('tuning_recommendations')
      .insert({
        recommendation_type: 'test',
        priority: 'medium',
        title: 'Test Recommendation',
        description: 'This is a test tuning recommendation',
        impact_description: 'Test impact',
        effort_level: 'low',
        automated: false,
        applied: false
      });

    if (error) throw error;

    // Verify recommendation was inserted
    const { data, error: selectError } = await this.supabase
      .from('tuning_recommendations')
      .select('*')
      .eq('title', 'Test Recommendation')
      .limit(1);

    if (selectError) throw selectError;
    if (!data || data.length === 0) throw new Error('Tuning recommendation not found');

    console.log('   💡 Tuning recommendations working correctly');
  }

  /**
   * Generate test query data
   */
  async generateTestQueryData() {
    const testQueries = [
      { pattern: 'SELECT * FROM exams WHERE id = $1', time: 150 },
      { pattern: 'SELECT * FROM students WHERE code = $1', time: 200 },
      { pattern: 'INSERT INTO exam_attempts (exam_id, student_id) VALUES ($1, $2)', time: 100 },
      { pattern: 'UPDATE exam_attempts SET status = $1 WHERE id = $2', time: 180 }
    ];

    for (const query of testQueries) {
      await this.supabase.rpc('log_query_performance', {
        p_query_hash: `hash_${Date.now()}_${Math.random()}`,
        p_query_pattern: query.pattern,
        p_execution_time_ms: query.time,
        p_row_count: Math.floor(Math.random() * 10) + 1,
        p_success: true,
        p_session_id: 'test_session'
      });
    }
  }

  /**
   * Generate slow query test data
   */
  async generateSlowQueryData() {
    const slowQueries = [
      { pattern: 'SELECT * FROM large_table WHERE unindexed_column = $1', time: 1500 },
      { pattern: 'SELECT COUNT(*) FROM exam_attempts GROUP BY exam_id', time: 2000 }
    ];

    for (const query of slowQueries) {
      await this.supabase.rpc('log_query_performance', {
        p_query_hash: `slow_hash_${Date.now()}_${Math.random()}`,
        p_query_pattern: query.pattern,
        p_execution_time_ms: query.time,
        p_row_count: Math.floor(Math.random() * 100) + 1,
        p_success: true,
        p_session_id: 'test_session'
      });
    }
  }

  /**
   * Display test results
   */
  displayResults() {
    console.log('\n' + '='.repeat(60));
    console.log('📋 DATABASE MONITORING TEST RESULTS');
    console.log('='.repeat(60));

    const passed = this.testResults.filter(r => r.status === 'PASS').length;
    const failed = this.testResults.filter(r => r.status === 'FAIL').length;

    console.log(`\n✅ Passed: ${passed}`);
    console.log(`❌ Failed: ${failed}`);
    console.log(`📊 Total: ${this.testResults.length}`);

    if (failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.testResults
        .filter(r => r.status === 'FAIL')
        .forEach(test => {
          console.log(`   • ${test.name}: ${test.error}`);
        });
    }

    console.log('\n' + '='.repeat(60));
    
    if (failed === 0) {
      console.log('🎉 All tests passed! Database monitoring is working correctly.');
    } else {
      console.log('⚠️ Some tests failed. Please review the errors above.');
    }
    
    console.log('='.repeat(60) + '\n');
  }

  /**
   * Cleanup test data
   */
  async cleanup() {
    console.log('🧹 Cleaning up test data...');

    try {
      // Clean up test performance metrics
      await this.supabase
        .from('performance_metrics')
        .delete()
        .eq('metric_type', 'test');

      // Clean up test alerts
      await this.supabase
        .from('database_alerts')
        .delete()
        .eq('alert_type', 'test');

      // Clean up test recommendations
      await this.supabase
        .from('tuning_recommendations')
        .delete()
        .eq('recommendation_type', 'test');

      console.log('✅ Test data cleaned up');
    } catch (error) {
      console.log('⚠️ Cleanup failed:', error.message);
    }
  }
}

// Main execution
async function main() {
  try {
    const tester = new DatabaseMonitoringTester();
    
    await tester.runTests();
    
    // Ask if user wants to cleanup
    const cleanup = process.argv.includes('--cleanup');
    if (cleanup) {
      await tester.cleanup();
    } else {
      console.log('💡 Run with --cleanup flag to remove test data');
    }
    
    // Exit with appropriate code
    const failed = tester.testResults.filter(r => r.status === 'FAIL').length;
    process.exit(failed > 0 ? 1 : 0);
    
  } catch (error) {
    console.error('❌ Test script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { DatabaseMonitoringTester };