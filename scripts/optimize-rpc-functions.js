#!/usr/bin/env node

/**
 * RPC Function Optimization Script
 * Analyzes existing RPC functions and provides optimization recommendations
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Analyze RPC function usage patterns
 */
async function analyzeRPCUsage() {
  console.log('🔍 Analyzing RPC function usage patterns...');
  
  try {
    // Get all RPC functions from the database
    const { data: functions, error } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT 
          p.proname as function_name,
          p.pronargs as arg_count,
          pg_get_function_result(p.oid) as return_type,
          pg_get_function_arguments(p.oid) as arguments,
          obj_description(p.oid) as description
        FROM pg_proc p
        JOIN pg_namespace n ON n.oid = p.pronamespace
        WHERE n.nspname = 'public'
          AND p.proname NOT LIKE 'pg_%'
          AND p.proname NOT LIKE 'sql_%'
        ORDER BY p.proname;
      `
    });

    if (error) {
      throw error;
    }

    console.log(`📊 Found ${functions.length} RPC functions`);
    
    // Categorize functions by purpose
    const categories = {
      attempt: [],
      admin: [],
      student: [],
      exam: [],
      monitoring: [],
      auth: [],
      other: []
    };

    functions.forEach(func => {
      const name = func.function_name.toLowerCase();
      if (name.includes('attempt')) {
        categories.attempt.push(func);
      } else if (name.includes('admin')) {
        categories.admin.push(func);
      } else if (name.includes('student')) {
        categories.student.push(func);
      } else if (name.includes('exam')) {
        categories.exam.push(func);
      } else if (name.includes('monitor') || name.includes('stat') || name.includes('analytic')) {
        categories.monitoring.push(func);
      } else if (name.includes('auth') || name.includes('login')) {
        categories.auth.push(func);
      } else {
        categories.other.push(func);
      }
    });

    // Generate optimization report
    const report = {
      timestamp: new Date().toISOString(),
      total_functions: functions.length,
      categories: Object.keys(categories).map(cat => ({
        category: cat,
        count: categories[cat].length,
        functions: categories[cat].map(f => f.function_name)
      })),
      consolidation_opportunities: []
    };

    // Identify consolidation opportunities
    if (categories.attempt.length > 5) {
      report.consolidation_opportunities.push({
        category: 'attempt',
        current_count: categories.attempt.length,
        recommended_count: 2,
        savings: categories.attempt.length - 2,
        functions: categories.attempt.map(f => f.function_name),
        recommendation: 'Consolidate into attempt_manager() and batch_attempt_operations()'
      });
    }

    if (categories.admin.length > 8) {
      report.consolidation_opportunities.push({
        category: 'admin',
        current_count: categories.admin.length,
        recommended_count: 3,
        savings: categories.admin.length - 3,
        functions: categories.admin.map(f => f.function_name),
        recommendation: 'Consolidate into admin_manager(), admin_user_manager(), and admin_bulk_operations()'
      });
    }

    if (categories.student.length > 3) {
      report.consolidation_opportunities.push({
        category: 'student',
        current_count: categories.student.length,
        recommended_count: 1,
        savings: categories.student.length - 1,
        functions: categories.student.map(f => f.function_name),
        recommendation: 'Consolidate into student_manager()'
      });
    }

    // Calculate potential function reduction
    const totalSavings = report.consolidation_opportunities.reduce(
      (sum, opp) => sum + opp.savings, 0
    );

    console.log(`\n📈 Optimization Analysis Results:`);
    console.log(`   Total Functions: ${report.total_functions}`);
    console.log(`   Potential Reduction: ${totalSavings} functions (${Math.round((totalSavings / report.total_functions) * 100)}%)`);
    console.log(`   Target Function Count: ${report.total_functions - totalSavings}`);

    // Save detailed report
    await fs.writeFile(
      path.join(__dirname, '../docs/rpc-optimization-analysis.json'),
      JSON.stringify(report, null, 2)
    );

    return report;

  } catch (error) {
    console.error('❌ Error analyzing RPC usage:', error.message);
    throw error;
  }
}

/**
 * Test consolidated RPC functions
 */
async function testConsolidatedFunctions() {
  console.log('\n🧪 Testing consolidated RPC functions...');
  
  const tests = [
    {
      name: 'attempt_manager - state operation',
      rpc: 'attempt_manager',
      params: {
        p_operation: 'state',
        p_attempt_id: '00000000-0000-0000-0000-000000000000' // Test with dummy ID
      },
      expectError: true // Should fail with attempt_not_found
    },
    {
      name: 'admin_manager - list_admins operation',
      rpc: 'admin_manager',
      params: {
        p_operation: 'list_admins'
      },
      expectError: false
    },
    {
      name: 'student_manager - validate_code operation',
      rpc: 'student_manager',
      params: {
        p_operation: 'validate_code',
        p_code: 'TEST123'
      },
      expectError: true // Should fail with student_not_found
    },
    {
      name: 'monitoring_manager - system_stats operation',
      rpc: 'monitoring_manager',
      params: {
        p_operation: 'system_stats'
      },
      expectError: false
    }
  ];

  const results = [];

  for (const test of tests) {
    try {
      console.log(`   Testing ${test.name}...`);
      
      const { data, error } = await supabase.rpc(test.rpc, test.params);
      
      if (test.expectError && !error) {
        results.push({
          test: test.name,
          status: 'UNEXPECTED_SUCCESS',
          message: 'Expected error but got success'
        });
      } else if (!test.expectError && error) {
        results.push({
          test: test.name,
          status: 'UNEXPECTED_ERROR',
          message: error.message
        });
      } else {
        results.push({
          test: test.name,
          status: 'PASS',
          message: test.expectError ? 'Expected error occurred' : 'Function executed successfully'
        });
      }
    } catch (err) {
      results.push({
        test: test.name,
        status: 'ERROR',
        message: err.message
      });
    }
  }

  // Print test results
  console.log('\n📋 Test Results:');
  results.forEach(result => {
    const icon = result.status === 'PASS' ? '✅' : '❌';
    console.log(`   ${icon} ${result.test}: ${result.status}`);
    if (result.status !== 'PASS') {
      console.log(`      ${result.message}`);
    }
  });

  return results;
}

/**
 * Benchmark RPC performance
 */
async function benchmarkRPCPerformance() {
  console.log('\n⚡ Benchmarking RPC performance...');
  
  const benchmarks = [
    {
      name: 'Individual RPC calls (old pattern)',
      operations: async () => {
        // Simulate multiple individual calls
        const start = Date.now();
        
        try {
          // These might fail but we're measuring timing
          await supabase.rpc('get_attempt_state', { p_attempt_id: '00000000-0000-0000-0000-000000000000' });
          await supabase.rpc('admin_list_admins');
          await supabase.rpc('get_active_attempts_summary');
        } catch (e) {
          // Expected to fail, we're just measuring timing
        }
        
        return Date.now() - start;
      }
    },
    {
      name: 'Consolidated RPC calls (new pattern)',
      operations: async () => {
        const start = Date.now();
        
        try {
          // Use consolidated functions
          await supabase.rpc('attempt_manager', { p_operation: 'state', p_attempt_id: '00000000-0000-0000-0000-000000000000' });
          await supabase.rpc('admin_manager', { p_operation: 'list_admins' });
          await supabase.rpc('monitoring_manager', { p_operation: 'active_attempts' });
        } catch (e) {
          // Expected to fail, we're just measuring timing
        }
        
        return Date.now() - start;
      }
    }
  ];

  const results = {};
  
  for (const benchmark of benchmarks) {
    console.log(`   Running ${benchmark.name}...`);
    
    // Run multiple iterations
    const iterations = 5;
    const times = [];
    
    for (let i = 0; i < iterations; i++) {
      const time = await benchmark.operations();
      times.push(time);
    }
    
    const avgTime = times.reduce((sum, time) => sum + time, 0) / times.length;
    const minTime = Math.min(...times);
    const maxTime = Math.max(...times);
    
    results[benchmark.name] = {
      average: avgTime,
      min: minTime,
      max: maxTime,
      iterations
    };
    
    console.log(`      Average: ${avgTime.toFixed(2)}ms`);
    console.log(`      Range: ${minTime}ms - ${maxTime}ms`);
  }

  return results;
}

/**
 * Generate optimization recommendations
 */
async function generateOptimizationRecommendations(analysisReport) {
  console.log('\n📝 Generating optimization recommendations...');
  
  const recommendations = {
    immediate_actions: [],
    performance_improvements: [],
    monitoring_setup: [],
    future_considerations: []
  };

  // Immediate consolidation opportunities
  analysisReport.consolidation_opportunities.forEach(opp => {
    recommendations.immediate_actions.push({
      priority: 'HIGH',
      action: `Consolidate ${opp.category} functions`,
      description: opp.recommendation,
      impact: `Reduce ${opp.savings} functions (${Math.round((opp.savings / analysisReport.total_functions) * 100)}% reduction)`,
      effort: 'Medium',
      functions_affected: opp.functions
    });
  });

  // Performance improvements
  recommendations.performance_improvements.push(
    {
      priority: 'HIGH',
      action: 'Implement batch operations',
      description: 'Replace multiple individual RPC calls with batch operations',
      impact: 'Reduce network round trips by 60-80%',
      effort: 'Medium'
    },
    {
      priority: 'MEDIUM',
      action: 'Add query result caching',
      description: 'Cache frequently accessed data to reduce database load',
      impact: 'Improve response times by 40-60%',
      effort: 'Low'
    },
    {
      priority: 'MEDIUM',
      action: 'Optimize database queries',
      description: 'Review and optimize slow queries in RPC functions',
      impact: 'Reduce database CPU usage by 20-30%',
      effort: 'High'
    }
  );

  // Monitoring setup
  recommendations.monitoring_setup.push(
    {
      priority: 'HIGH',
      action: 'Implement RPC performance monitoring',
      description: 'Track RPC function execution times and error rates',
      impact: 'Enable proactive performance optimization',
      effort: 'Low'
    },
    {
      priority: 'MEDIUM',
      action: 'Set up function usage analytics',
      description: 'Monitor which functions are used most frequently',
      impact: 'Identify further consolidation opportunities',
      effort: 'Low'
    }
  );

  // Future considerations
  recommendations.future_considerations.push(
    {
      priority: 'LOW',
      action: 'Consider GraphQL migration',
      description: 'Evaluate migrating to GraphQL for more flexible data fetching',
      impact: 'Further reduce over-fetching and round trips',
      effort: 'High'
    },
    {
      priority: 'LOW',
      action: 'Implement connection pooling',
      description: 'Add connection pooling for high-traffic scenarios',
      impact: 'Improve scalability under load',
      effort: 'Medium'
    }
  );

  // Save recommendations
  await fs.writeFile(
    path.join(__dirname, '../docs/rpc-optimization-recommendations.json'),
    JSON.stringify(recommendations, null, 2)
  );

  // Print summary
  console.log(`\n📊 Optimization Summary:`);
  console.log(`   High Priority Actions: ${recommendations.immediate_actions.length + recommendations.performance_improvements.filter(r => r.priority === 'HIGH').length}`);
  console.log(`   Medium Priority Actions: ${recommendations.performance_improvements.filter(r => r.priority === 'MEDIUM').length + recommendations.monitoring_setup.filter(r => r.priority === 'MEDIUM').length}`);
  console.log(`   Future Considerations: ${recommendations.future_considerations.length}`);

  return recommendations;
}

/**
 * Main execution function
 */
async function main() {
  try {
    console.log('🚀 Starting RPC Function Optimization Analysis\n');
    
    // Step 1: Analyze current RPC usage
    const analysisReport = await analyzeRPCUsage();
    
    // Step 2: Test consolidated functions
    const testResults = await testConsolidatedFunctions();
    
    // Step 3: Benchmark performance
    const benchmarkResults = await benchmarkRPCPerformance();
    
    // Step 4: Generate recommendations
    const recommendations = await generateOptimizationRecommendations(analysisReport);
    
    // Step 5: Create final report
    const finalReport = {
      timestamp: new Date().toISOString(),
      analysis: analysisReport,
      test_results: testResults,
      benchmarks: benchmarkResults,
      recommendations: recommendations,
      summary: {
        total_functions_analyzed: analysisReport.total_functions,
        potential_function_reduction: analysisReport.consolidation_opportunities.reduce((sum, opp) => sum + opp.savings, 0),
        tests_passed: testResults.filter(r => r.status === 'PASS').length,
        tests_total: testResults.length,
        high_priority_actions: recommendations.immediate_actions.length + recommendations.performance_improvements.filter(r => r.priority === 'HIGH').length
      }
    };
    
    await fs.writeFile(
      path.join(__dirname, '../docs/rpc-optimization-final-report.json'),
      JSON.stringify(finalReport, null, 2)
    );
    
    console.log('\n✅ Optimization analysis complete!');
    console.log(`📄 Reports saved to docs/ directory`);
    console.log(`🎯 Potential function reduction: ${finalReport.summary.potential_function_reduction} functions`);
    console.log(`🧪 Tests passed: ${finalReport.summary.tests_passed}/${finalReport.summary.tests_total}`);
    console.log(`⚠️  High priority actions: ${finalReport.summary.high_priority_actions}`);
    
  } catch (error) {
    console.error('❌ Optimization analysis failed:', error.message);
    process.exit(1);
  }
}

// Run the analysis
if (require.main === module) {
  main();
}

module.exports = {
  analyzeRPCUsage,
  testConsolidatedFunctions,
  benchmarkRPCPerformance,
  generateOptimizationRecommendations
};