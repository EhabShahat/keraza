#!/usr/bin/env node

/**
 * Auto-Recovery System Test Script
 * Tests automated recovery, scaling, and load balancing functionality
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Test configuration
const TEST_CONFIG = {
  baseUrl: process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
  testDuration: 60000, // 1 minute
  requestInterval: 1000, // 1 second
  functions: ['admin', 'public', 'attempts']
};

class AutoRecoveryTester {
  constructor() {
    this.testResults = {
      circuit_breaker_tests: [],
      load_balancing_tests: [],
      scaling_tests: [],
      failover_tests: []
    };
    this.activeTests = new Set();
  }

  async runAllTests() {
    console.log('🧪 Starting Auto-Recovery System Tests...\n');

    try {
      // Test 1: Circuit Breaker Functionality
      await this.testCircuitBreaker();

      // Test 2: Load Balancing
      await this.testLoadBalancing();

      // Test 3: Auto Scaling
      await this.testAutoScaling();

      // Test 4: Failover Mechanisms
      await this.testFailover();

      // Generate test report
      this.generateTestReport();

    } catch (error) {
      console.error('❌ Test suite failed:', error);
      process.exit(1);
    }
  }

  async testCircuitBreaker() {
    console.log('🔧 Testing Circuit Breaker Functionality...');

    for (const functionName of TEST_CONFIG.functions) {
      console.log(`  Testing circuit breaker for ${functionName}...`);

      try {
        // Get initial circuit breaker state
        const initialState = await this.getCircuitBreakerState(functionName);
        console.log(`    Initial state: ${initialState?.state || 'unknown'}`);

        // Simulate failures to trigger circuit breaker
        const failureResults = await this.simulateFailures(functionName, 10);
        
        // Check if circuit breaker opened
        const postFailureState = await this.getCircuitBreakerState(functionName);
        console.log(`    Post-failure state: ${postFailureState?.state || 'unknown'}`);

        // Wait for recovery attempt
        console.log('    Waiting for recovery attempt...');
        await this.delay(30000); // 30 seconds

        // Check recovery state
        const recoveryState = await this.getCircuitBreakerState(functionName);
        console.log(`    Recovery state: ${recoveryState?.state || 'unknown'}`);

        this.testResults.circuit_breaker_tests.push({
          function_name: functionName,
          initial_state: initialState?.state,
          triggered_open: postFailureState?.state === 'open',
          recovery_attempted: recoveryState?.state === 'half_open' || recoveryState?.state === 'closed',
          failure_count: failureResults.failures,
          success_count: failureResults.successes
        });

        console.log(`    ✅ Circuit breaker test completed for ${functionName}`);

      } catch (error) {
        console.error(`    ❌ Circuit breaker test failed for ${functionName}:`, error.message);
        this.testResults.circuit_breaker_tests.push({
          function_name: functionName,
          error: error.message
        });
      }
    }

    console.log('✅ Circuit breaker tests completed\n');
  }

  async testLoadBalancing() {
    console.log('⚖️ Testing Load Balancing...');

    for (const functionName of TEST_CONFIG.functions) {
      console.log(`  Testing load balancing for ${functionName}...`);

      try {
        // Initialize multiple instances
        await this.initializeFunction(functionName);
        await this.delay(5000); // Wait for initialization

        // Send multiple requests and track routing
        const routingResults = await this.testRequestRouting(functionName, 20);
        
        // Analyze load distribution
        const distribution = this.analyzeLoadDistribution(routingResults);

        this.testResults.load_balancing_tests.push({
          function_name: functionName,
          total_requests: routingResults.length,
          unique_targets: distribution.unique_targets,
          distribution_variance: distribution.variance,
          average_response_time: distribution.avg_response_time,
          success_rate: distribution.success_rate
        });

        console.log(`    ✅ Load balancing test completed for ${functionName}`);
        console.log(`      Unique targets: ${distribution.unique_targets}`);
        console.log(`      Success rate: ${distribution.success_rate.toFixed(1)}%`);

      } catch (error) {
        console.error(`    ❌ Load balancing test failed for ${functionName}:`, error.message);
        this.testResults.load_balancing_tests.push({
          function_name: functionName,
          error: error.message
        });
      }
    }

    console.log('✅ Load balancing tests completed\n');
  }

  async testAutoScaling() {
    console.log('📈 Testing Auto Scaling...');

    for (const functionName of TEST_CONFIG.functions) {
      console.log(`  Testing auto scaling for ${functionName}...`);

      try {
        // Get initial instance count
        const initialInstances = await this.getFunctionInstances(functionName);
        const initialCount = initialInstances.length;

        // Trigger scale up by generating load
        console.log('    Generating load to trigger scale up...');
        const loadTest = this.generateContinuousLoad(functionName, 30000); // 30 seconds

        // Wait and check for scale up
        await this.delay(20000); // 20 seconds
        const scaleUpInstances = await this.getFunctionInstances(functionName);
        const scaleUpCount = scaleUpInstances.length;

        // Stop load generation
        this.activeTests.delete(loadTest);

        // Wait for scale down
        console.log('    Waiting for scale down...');
        await this.delay(60000); // 1 minute
        const scaleDownInstances = await this.getFunctionInstances(functionName);
        const scaleDownCount = scaleDownInstances.length;

        this.testResults.scaling_tests.push({
          function_name: functionName,
          initial_instances: initialCount,
          scale_up_instances: scaleUpCount,
          scale_down_instances: scaleDownCount,
          scaled_up: scaleUpCount > initialCount,
          scaled_down: scaleDownCount < scaleUpCount
        });

        console.log(`    ✅ Auto scaling test completed for ${functionName}`);
        console.log(`      Initial: ${initialCount}, Scale up: ${scaleUpCount}, Scale down: ${scaleDownCount}`);

      } catch (error) {
        console.error(`    ❌ Auto scaling test failed for ${functionName}:`, error.message);
        this.testResults.scaling_tests.push({
          function_name: functionName,
          error: error.message
        });
      }
    }

    console.log('✅ Auto scaling tests completed\n');
  }

  async testFailover() {
    console.log('🔄 Testing Failover Mechanisms...');

    for (const functionName of TEST_CONFIG.functions) {
      console.log(`  Testing failover for ${functionName}...`);

      try {
        // Trigger manual failover
        const failoverResult = await this.triggerFailover(functionName);
        
        // Test if requests still work after failover
        const postFailoverTest = await this.testRequestRouting(functionName, 5);
        const successRate = postFailoverTest.filter(r => r.success).length / postFailoverTest.length;

        this.testResults.failover_tests.push({
          function_name: functionName,
          failover_triggered: failoverResult.success,
          post_failover_success_rate: successRate * 100,
          response_time_impact: this.calculateResponseTimeImpact(postFailoverTest)
        });

        console.log(`    ✅ Failover test completed for ${functionName}`);
        console.log(`      Post-failover success rate: ${(successRate * 100).toFixed(1)}%`);

      } catch (error) {
        console.error(`    ❌ Failover test failed for ${functionName}:`, error.message);
        this.testResults.failover_tests.push({
          function_name: functionName,
          error: error.message
        });
      }
    }

    console.log('✅ Failover tests completed\n');
  }

  async simulateFailures(functionName, count) {
    const results = { failures: 0, successes: 0 };

    for (let i = 0; i < count; i++) {
      try {
        // Simulate a request that should fail
        const response = await fetch(`${TEST_CONFIG.baseUrl}/api/${functionName}/nonexistent-endpoint`, {
          method: 'GET',
          headers: { 'User-Agent': 'AutoRecoveryTester/1.0' }
        });

        if (response.ok) {
          results.successes++;
        } else {
          results.failures++;
        }
      } catch (error) {
        results.failures++;
      }

      await this.delay(100); // Small delay between requests
    }

    return results;
  }

  async testRequestRouting(functionName, count) {
    const results = [];

    for (let i = 0; i < count; i++) {
      const startTime = Date.now();
      
      try {
        const response = await fetch(`${TEST_CONFIG.baseUrl}/api/${functionName}/health`, {
          method: 'GET',
          headers: { 'User-Agent': 'AutoRecoveryTester/1.0' }
        });

        const responseTime = Date.now() - startTime;
        const targetInstance = response.headers.get('X-Target-Instance');

        results.push({
          success: response.ok,
          response_time: responseTime,
          target_instance: targetInstance,
          status_code: response.status
        });

      } catch (error) {
        results.push({
          success: false,
          response_time: Date.now() - startTime,
          target_instance: null,
          error: error.message
        });
      }

      await this.delay(100); // Small delay between requests
    }

    return results;
  }

  generateContinuousLoad(functionName, duration) {
    const testId = `load-${functionName}-${Date.now()}`;
    this.activeTests.add(testId);

    const interval = setInterval(async () => {
      if (!this.activeTests.has(testId)) {
        clearInterval(interval);
        return;
      }

      try {
        await fetch(`${TEST_CONFIG.baseUrl}/api/${functionName}/health`, {
          method: 'GET',
          headers: { 'User-Agent': 'AutoRecoveryTester/1.0' }
        });
      } catch (error) {
        // Ignore errors during load generation
      }
    }, 100); // 10 requests per second

    // Auto-stop after duration
    setTimeout(() => {
      this.activeTests.delete(testId);
      clearInterval(interval);
    }, duration);

    return testId;
  }

  analyzeLoadDistribution(results) {
    const targets = results
      .filter(r => r.target_instance)
      .map(r => r.target_instance);

    const uniqueTargets = [...new Set(targets)].length;
    const successfulResults = results.filter(r => r.success);
    
    const avgResponseTime = successfulResults.length > 0
      ? successfulResults.reduce((sum, r) => sum + r.response_time, 0) / successfulResults.length
      : 0;

    const successRate = (successfulResults.length / results.length) * 100;

    // Calculate distribution variance
    const targetCounts = targets.reduce((acc, target) => {
      acc[target] = (acc[target] || 0) + 1;
      return acc;
    }, {});

    const counts = Object.values(targetCounts);
    const avgCount = counts.length > 0 ? counts.reduce((a, b) => a + b, 0) / counts.length : 0;
    const variance = counts.length > 0 
      ? counts.reduce((sum, count) => sum + Math.pow(count - avgCount, 2), 0) / counts.length
      : 0;

    return {
      unique_targets: uniqueTargets,
      variance,
      avg_response_time: avgResponseTime,
      success_rate: successRate
    };
  }

  calculateResponseTimeImpact(results) {
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length === 0) return 0;

    return successfulResults.reduce((sum, r) => sum + r.response_time, 0) / successfulResults.length;
  }

  async getCircuitBreakerState(functionName) {
    try {
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/admin/monitoring/auto-recovery?action=circuit-breakers&function=${functionName}`
      );
      
      if (!response.ok) return null;
      
      const data = await response.json();
      return data.circuit_breaker;
    } catch (error) {
      console.error(`Error getting circuit breaker state for ${functionName}:`, error);
      return null;
    }
  }

  async getFunctionInstances(functionName) {
    try {
      const response = await fetch(
        `${TEST_CONFIG.baseUrl}/api/admin/monitoring/auto-recovery?action=instances&function=${functionName}`
      );
      
      if (!response.ok) return [];
      
      const data = await response.json();
      return data.instances || [];
    } catch (error) {
      console.error(`Error getting function instances for ${functionName}:`, error);
      return [];
    }
  }

  async initializeFunction(functionName) {
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/admin/monitoring/auto-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'initialize',
          function_name: functionName
        })
      });

      return { success: response.ok };
    } catch (error) {
      console.error(`Error initializing function ${functionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  async triggerFailover(functionName) {
    try {
      const response = await fetch(`${TEST_CONFIG.baseUrl}/api/admin/monitoring/auto-recovery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'failover',
          function_name: functionName
        })
      });

      return { success: response.ok };
    } catch (error) {
      console.error(`Error triggering failover for ${functionName}:`, error);
      return { success: false, error: error.message };
    }
  }

  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  generateTestReport() {
    console.log('📊 Auto-Recovery Test Report');
    console.log('=' .repeat(50));

    // Circuit Breaker Results
    console.log('\n🔧 Circuit Breaker Tests:');
    this.testResults.circuit_breaker_tests.forEach(test => {
      if (test.error) {
        console.log(`  ❌ ${test.function_name}: ${test.error}`);
      } else {
        console.log(`  ✅ ${test.function_name}:`);
        console.log(`     Triggered Open: ${test.triggered_open ? 'Yes' : 'No'}`);
        console.log(`     Recovery Attempted: ${test.recovery_attempted ? 'Yes' : 'No'}`);
        console.log(`     Failures: ${test.failure_count}, Successes: ${test.success_count}`);
      }
    });

    // Load Balancing Results
    console.log('\n⚖️ Load Balancing Tests:');
    this.testResults.load_balancing_tests.forEach(test => {
      if (test.error) {
        console.log(`  ❌ ${test.function_name}: ${test.error}`);
      } else {
        console.log(`  ✅ ${test.function_name}:`);
        console.log(`     Unique Targets: ${test.unique_targets}`);
        console.log(`     Success Rate: ${test.success_rate.toFixed(1)}%`);
        console.log(`     Avg Response Time: ${test.average_response_time.toFixed(0)}ms`);
      }
    });

    // Scaling Results
    console.log('\n📈 Auto Scaling Tests:');
    this.testResults.scaling_tests.forEach(test => {
      if (test.error) {
        console.log(`  ❌ ${test.function_name}: ${test.error}`);
      } else {
        console.log(`  ✅ ${test.function_name}:`);
        console.log(`     Scaled Up: ${test.scaled_up ? 'Yes' : 'No'} (${test.initial_instances} → ${test.scale_up_instances})`);
        console.log(`     Scaled Down: ${test.scaled_down ? 'Yes' : 'No'} (${test.scale_up_instances} → ${test.scale_down_instances})`);
      }
    });

    // Failover Results
    console.log('\n🔄 Failover Tests:');
    this.testResults.failover_tests.forEach(test => {
      if (test.error) {
        console.log(`  ❌ ${test.function_name}: ${test.error}`);
      } else {
        console.log(`  ✅ ${test.function_name}:`);
        console.log(`     Failover Triggered: ${test.failover_triggered ? 'Yes' : 'No'}`);
        console.log(`     Post-Failover Success Rate: ${test.post_failover_success_rate.toFixed(1)}%`);
        console.log(`     Response Time Impact: ${test.response_time_impact.toFixed(0)}ms`);
      }
    });

    // Overall Summary
    const totalTests = Object.values(this.testResults).flat().length;
    const failedTests = Object.values(this.testResults).flat().filter(t => t.error).length;
    const successRate = ((totalTests - failedTests) / totalTests) * 100;

    console.log('\n📋 Summary:');
    console.log(`  Total Tests: ${totalTests}`);
    console.log(`  Passed: ${totalTests - failedTests}`);
    console.log(`  Failed: ${failedTests}`);
    console.log(`  Success Rate: ${successRate.toFixed(1)}%`);

    if (successRate >= 80) {
      console.log('\n🎉 Auto-Recovery System is functioning well!');
    } else {
      console.log('\n⚠️ Auto-Recovery System needs attention.');
    }
  }
}

async function main() {
  const tester = new AutoRecoveryTester();
  await tester.runAllTests();
}

if (require.main === module) {
  main().catch(error => {
    console.error('Test execution failed:', error);
    process.exit(1);
  });
}

module.exports = AutoRecoveryTester;