#!/usr/bin/env node

/**
 * Test Suite for Consolidated RPC Functions
 * Comprehensive testing of optimized RPC functions
 */

const { createClient } = require('@supabase/supabase-js');

// Configuration
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
  console.error('Missing required environment variables: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Test suite configuration
 */
const TEST_CONFIG = {
  timeout: 30000, // 30 seconds
  retries: 3,
  parallel: false // Set to true for parallel execution
};

/**
 * Test result tracking
 */
class TestRunner {
  constructor() {
    this.results = [];
    this.startTime = Date.now();
  }

  async runTest(testName, testFn, options = {}) {
    const testStart = Date.now();
    const timeout = options.timeout || TEST_CONFIG.timeout;
    const retries = options.retries || TEST_CONFIG.retries;

    console.log(`🧪 Running: ${testName}`);

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        // Create timeout promise
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Test timeout')), timeout);
        });

        // Run test with timeout
        const result = await Promise.race([testFn(), timeoutPromise]);
        
        const duration = Date.now() - testStart;
        
        this.results.push({
          name: testName,
          status: 'PASS',
          duration,
          attempt,
          result
        });

        console.log(`   ✅ PASS (${duration}ms)`);
        return result;

      } catch (error) {
        const duration = Date.now() - testStart;
        
        if (attempt === retries) {
          this.results.push({
            name: testName,
            status: 'FAIL',
            duration,
            attempt,
            error: error.message
          });

          console.log(`   ❌ FAIL (${duration}ms): ${error.message}`);
          return null;
        } else {
          console.log(`   🔄 Retry ${attempt}/${retries}: ${error.message}`);
        }
      }
    }
  }

  getSummary() {
    const totalTests = this.results.length;
    const passedTests = this.results.filter(r => r.status === 'PASS').length;
    const failedTests = totalTests - passedTests;
    const totalDuration = Date.now() - this.startTime;
    const avgDuration = this.results.reduce((sum, r) => sum + r.duration, 0) / totalTests;

    return {
      total: totalTests,
      passed: passedTests,
      failed: failedTests,
      passRate: Math.round((passedTests / totalTests) * 100),
      totalDuration,
      avgDuration: Math.round(avgDuration)
    };
  }
}

/**
 * Test data setup and cleanup
 */
class TestDataManager {
  constructor(supabase) {
    this.supabase = supabase;
    this.createdData = {
      exams: [],
      students: [],
      attempts: [],
      users: []
    };
  }

  async setupTestData() {
    console.log('🔧 Setting up test data...');

    try {
      // Create test exam
      const { data: exam, error: examError } = await this.supabase
        .from('exams')
        .insert({
          title: 'Test Exam for RPC Testing',
          description: 'Automated test exam',
          status: 'published',
          access_type: 'open',
          duration_minutes: 60,
          settings: { attempt_limit: 1 }
        })
        .select()
        .single();

      if (examError) throw examError;
      this.createdData.exams.push(exam.id);

      // Create test questions
      const questions = [
        {
          exam_id: exam.id,
          question_text: 'Test Question 1',
          question_type: 'multiple_choice',
          options: ['A', 'B', 'C', 'D'],
          correct_answers: ['A'],
          points: 1,
          order_index: 1
        },
        {
          exam_id: exam.id,
          question_text: 'Test Question 2',
          question_type: 'true_false',
          options: ['True', 'False'],
          correct_answers: ['True'],
          points: 1,
          order_index: 2
        }
      ];

      const { error: questionsError } = await this.supabase
        .from('questions')
        .insert(questions);

      if (questionsError) throw questionsError;

      // Create test student
      const { data: student, error: studentError } = await this.supabase
        .from('students')
        .insert({
          code: 'TEST001',
          student_name: 'Test Student',
          mobile_number: '+1234567890'
        })
        .select()
        .single();

      if (studentError) throw studentError;
      this.createdData.students.push(student.id);

      console.log(`   ✅ Test data created (Exam: ${exam.id}, Student: ${student.id})`);
      
      return {
        exam,
        student,
        questions
      };

    } catch (error) {
      console.error('   ❌ Failed to setup test data:', error.message);
      throw error;
    }
  }

  async cleanupTestData() {
    console.log('🧹 Cleaning up test data...');

    try {
      // Clean up in reverse order of dependencies
      if (this.createdData.attempts.length > 0) {
        await this.supabase
          .from('exam_attempts')
          .delete()
          .in('id', this.createdData.attempts);
      }

      if (this.createdData.students.length > 0) {
        await this.supabase
          .from('students')
          .delete()
          .in('id', this.createdData.students);
      }

      if (this.createdData.exams.length > 0) {
        // Questions will be deleted by cascade
        await this.supabase
          .from('exams')
          .delete()
          .in('id', this.createdData.exams);
      }

      if (this.createdData.users.length > 0) {
        await this.supabase
          .from('users')
          .delete()
          .in('id', this.createdData.users);
      }

      console.log('   ✅ Test data cleaned up');

    } catch (error) {
      console.error('   ⚠️  Cleanup warning:', error.message);
    }
  }
}

/**
 * Test suites
 */
class ConsolidatedRPCTests {
  constructor(supabase, testData) {
    this.supabase = supabase;
    this.testData = testData;
  }

  async testAttemptManager() {
    const tests = [];

    // Test start attempt
    tests.push(async () => {
      const { data, error } = await this.supabase.rpc('attempt_manager', {
        p_operation: 'start',
        p_exam_id: this.testData.exam.id,
        p_student_name: 'Test Student',
        p_ip: '127.0.0.1'
      });

      if (error) throw new Error(`Start attempt failed: ${error.message}`);
      if (!data.success || !data.attempt_id) throw new Error('Invalid start attempt response');

      // Store attempt ID for cleanup
      this.testData.attemptId = data.attempt_id;
      return data;
    });

    // Test get attempt state
    tests.push(async () => {
      if (!this.testData.attemptId) throw new Error('No attempt ID available');

      const { data, error } = await this.supabase.rpc('attempt_manager', {
        p_operation: 'state',
        p_attempt_id: this.testData.attemptId
      });

      if (error) throw new Error(`Get state failed: ${error.message}`);
      if (!data.success || !data.state) throw new Error('Invalid state response');

      return data;
    });

    // Test save attempt
    tests.push(async () => {
      if (!this.testData.attemptId) throw new Error('No attempt ID available');

      const answers = { '1': ['A'], '2': ['True'] };
      const autoSaveData = { progress: { answered: 2, total: 2 } };

      const { data, error } = await this.supabase.rpc('attempt_manager', {
        p_operation: 'save',
        p_attempt_id: this.testData.attemptId,
        p_answers: answers,
        p_auto_save_data: autoSaveData,
        p_expected_version: 1
      });

      if (error) throw new Error(`Save attempt failed: ${error.message}`);
      if (!data.success || !data.new_version) throw new Error('Invalid save response');

      return data;
    });

    // Test save and get state (combined operation)
    tests.push(async () => {
      if (!this.testData.attemptId) throw new Error('No attempt ID available');

      const answers = { '1': ['A'], '2': ['True'] };
      const autoSaveData = { progress: { answered: 2, total: 2 } };

      const { data, error } = await this.supabase.rpc('attempt_manager', {
        p_operation: 'save_and_state',
        p_attempt_id: this.testData.attemptId,
        p_answers: answers,
        p_auto_save_data: autoSaveData,
        p_expected_version: 2
      });

      if (error) throw new Error(`Save and state failed: ${error.message}`);
      if (!data.success || !data.new_version || !data.state) throw new Error('Invalid save and state response');

      return data;
    });

    // Test submit attempt
    tests.push(async () => {
      if (!this.testData.attemptId) throw new Error('No attempt ID available');

      const { data, error } = await this.supabase.rpc('attempt_manager', {
        p_operation: 'submit',
        p_attempt_id: this.testData.attemptId
      });

      if (error) throw new Error(`Submit attempt failed: ${error.message}`);
      if (!data.success) throw new Error('Invalid submit response');

      return data;
    });

    return tests;
  }

  async testAdminManager() {
    const tests = [];

    // Test list admins
    tests.push(async () => {
      const { data, error } = await this.supabase.rpc('admin_manager', {
        p_operation: 'list_admins'
      });

      if (error) throw new Error(`List admins failed: ${error.message}`);
      if (!Array.isArray(data)) throw new Error('Invalid list admins response');

      return data;
    });

    // Test cleanup expired attempts
    tests.push(async () => {
      const { data, error } = await this.supabase.rpc('admin_manager', {
        p_operation: 'cleanup_expired'
      });

      if (error) throw new Error(`Cleanup expired failed: ${error.message}`);
      if (!data.success) throw new Error('Invalid cleanup response');

      return data;
    });

    // Test list attempts
    tests.push(async () => {
      const { data, error } = await this.supabase.rpc('admin_manager', {
        p_operation: 'list_attempts',
        p_exam_id: this.testData.exam.id
      });

      if (error) throw new Error(`List attempts failed: ${error.message}`);
      if (!Array.isArray(data)) throw new Error('Invalid list attempts response');

      return data;
    });

    return tests;
  }

  async testStudentManager() {
    const tests = [];

    // Test get by code
    tests.push(async () => {
      const { data, error } = await this.supabase.rpc('student_manager', {
        p_operation: 'get_by_code',
        p_code: this.testData.student.code
      });

      if (error) throw new Error(`Get by code failed: ${error.message}`);
      if (!data.id) throw new Error('Invalid get by code response');

      return data;
    });

    // Test validate code
    tests.push(async () => {
      const { data, error } = await this.supabase.rpc('student_manager', {
        p_operation: 'validate_code',
        p_code: this.testData.student.code,
        p_exam_id: this.testData.exam.id
      });

      if (error) throw new Error(`Validate code failed: ${error.message}`);
      if (!data.valid) throw new Error('Invalid validate code response');

      return data;
    });

    // Test bulk insert
    tests.push(async () => {
      const bulkData = [
        {
          code: 'BULK001',
          student_name: 'Bulk Student 1',
          mobile_number: '+1111111111'
        },
        {
          code: 'BULK002',
          student_name: 'Bulk Student 2',
          mobile_number: '+2222222222'
        }
      ];

      const { data, error } = await this.supabase.rpc('student_manager', {
        p_operation: 'bulk_insert',
        p_bulk_data: bulkData
      });

      if (error) throw new Error(`Bulk insert failed: ${error.message}`);
      if (!data.success) throw new Error('Invalid bulk insert response');

      // Clean up bulk inserted students
      await this.supabase
        .from('students')
        .delete()
        .in('code', ['BULK001', 'BULK002']);

      return data;
    });

    return tests;
  }

  async testMonitoringManager() {
    const tests = [];

    // Test active attempts
    tests.push(async () => {
      const { data, error } = await this.supabase.rpc('monitoring_manager', {
        p_operation: 'active_attempts'
      });

      if (error) throw new Error(`Active attempts failed: ${error.message}`);
      if (!Array.isArray(data)) throw new Error('Invalid active attempts response');

      return data;
    });

    // Test system stats
    tests.push(async () => {
      const { data, error } = await this.supabase.rpc('monitoring_manager', {
        p_operation: 'system_stats'
      });

      if (error) throw new Error(`System stats failed: ${error.message}`);
      if (!data.total_exams && data.total_exams !== 0) throw new Error('Invalid system stats response');

      return data;
    });

    // Test performance summary
    tests.push(async () => {
      const { data, error } = await this.supabase.rpc('monitoring_manager', {
        p_operation: 'performance_summary'
      });

      if (error) throw new Error(`Performance summary failed: ${error.message}`);
      if (!data.avg_duration_minutes && data.avg_duration_minutes !== 0) throw new Error('Invalid performance summary response');

      return data;
    });

    return tests;
  }

  async testBatchOperations() {
    const tests = [];

    // Test batch get attempt states
    tests.push(async () => {
      const attemptIds = this.testData.attemptId ? [this.testData.attemptId] : [];
      
      if (attemptIds.length === 0) {
        // Skip if no attempts available
        return { skipped: true, reason: 'No attempt IDs available' };
      }

      const { data, error } = await this.supabase.rpc('batch_get_attempt_states', {
        p_attempt_ids: attemptIds
      });

      if (error) throw new Error(`Batch get attempt states failed: ${error.message}`);
      if (!Array.isArray(data)) throw new Error('Invalid batch get attempt states response');

      return data;
    });

    // Test batch get exam summaries
    tests.push(async () => {
      const examIds = [this.testData.exam.id];

      const { data, error } = await this.supabase.rpc('batch_get_exam_summaries', {
        p_exam_ids: examIds
      });

      if (error) throw new Error(`Batch get exam summaries failed: ${error.message}`);
      if (!Array.isArray(data)) throw new Error('Invalid batch get exam summaries response');

      return data;
    });

    return tests;
  }
}

/**
 * Performance benchmarking
 */
class PerformanceBenchmark {
  constructor(supabase, testData) {
    this.supabase = supabase;
    this.testData = testData;
  }

  async benchmarkConsolidatedVsIndividual() {
    console.log('⚡ Running performance benchmarks...');

    const iterations = 5;
    const results = {
      consolidated: [],
      individual: []
    };

    // Benchmark consolidated functions
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      
      try {
        await this.supabase.rpc('monitoring_manager', {
          p_operation: 'system_stats'
        });
        
        await this.supabase.rpc('admin_manager', {
          p_operation: 'list_admins'
        });
        
        results.consolidated.push(Date.now() - start);
      } catch (error) {
        console.warn(`   Consolidated benchmark iteration ${i + 1} failed:`, error.message);
      }
    }

    // Benchmark individual functions (if they exist)
    for (let i = 0; i < iterations; i++) {
      const start = Date.now();
      
      try {
        // Try to call individual functions
        await this.supabase.rpc('get_active_attempts_summary');
        await this.supabase.rpc('admin_list_admins');
        
        results.individual.push(Date.now() - start);
      } catch (error) {
        // Individual functions might not exist or might fail
        results.individual.push(null);
      }
    }

    // Calculate averages
    const consolidatedAvg = results.consolidated.length > 0 
      ? results.consolidated.reduce((sum, time) => sum + time, 0) / results.consolidated.length
      : 0;

    const individualTimes = results.individual.filter(time => time !== null);
    const individualAvg = individualTimes.length > 0
      ? individualTimes.reduce((sum, time) => sum + time, 0) / individualTimes.length
      : 0;

    console.log(`   Consolidated functions average: ${consolidatedAvg.toFixed(2)}ms`);
    console.log(`   Individual functions average: ${individualAvg > 0 ? individualAvg.toFixed(2) + 'ms' : 'N/A'}`);
    
    if (consolidatedAvg > 0 && individualAvg > 0) {
      const improvement = ((individualAvg - consolidatedAvg) / individualAvg) * 100;
      console.log(`   Performance improvement: ${improvement.toFixed(1)}%`);
    }

    return {
      consolidated: consolidatedAvg,
      individual: individualAvg,
      improvement: individualAvg > 0 ? ((individualAvg - consolidatedAvg) / individualAvg) * 100 : null
    };
  }
}

/**
 * Main test execution
 */
async function main() {
  const runner = new TestRunner();
  const dataManager = new TestDataManager(supabase);
  
  console.log('🚀 Starting Consolidated RPC Function Tests\n');

  try {
    // Setup test data
    const testData = await dataManager.setupTestData();
    
    // Initialize test suites
    const rpcTests = new ConsolidatedRPCTests(supabase, testData);
    const benchmark = new PerformanceBenchmark(supabase, testData);

    console.log('\n📋 Running Test Suites:\n');

    // Run attempt manager tests
    const attemptTests = await rpcTests.testAttemptManager();
    for (let i = 0; i < attemptTests.length; i++) {
      await runner.runTest(`Attempt Manager Test ${i + 1}`, attemptTests[i]);
    }

    // Run admin manager tests
    const adminTests = await rpcTests.testAdminManager();
    for (let i = 0; i < adminTests.length; i++) {
      await runner.runTest(`Admin Manager Test ${i + 1}`, adminTests[i]);
    }

    // Run student manager tests
    const studentTests = await rpcTests.testStudentManager();
    for (let i = 0; i < studentTests.length; i++) {
      await runner.runTest(`Student Manager Test ${i + 1}`, studentTests[i]);
    }

    // Run monitoring manager tests
    const monitoringTests = await rpcTests.testMonitoringManager();
    for (let i = 0; i < monitoringTests.length; i++) {
      await runner.runTest(`Monitoring Manager Test ${i + 1}`, monitoringTests[i]);
    }

    // Run batch operation tests
    const batchTests = await rpcTests.testBatchOperations();
    for (let i = 0; i < batchTests.length; i++) {
      await runner.runTest(`Batch Operations Test ${i + 1}`, batchTests[i]);
    }

    // Run performance benchmarks
    console.log('\n');
    const benchmarkResults = await benchmark.benchmarkConsolidatedVsIndividual();

    // Print summary
    const summary = runner.getSummary();
    console.log('\n📊 Test Summary:');
    console.log(`   Total Tests: ${summary.total}`);
    console.log(`   Passed: ${summary.passed} (${summary.passRate}%)`);
    console.log(`   Failed: ${summary.failed}`);
    console.log(`   Total Duration: ${summary.totalDuration}ms`);
    console.log(`   Average Test Duration: ${summary.avgDuration}ms`);

    if (benchmarkResults.improvement !== null) {
      console.log(`   Performance Improvement: ${benchmarkResults.improvement.toFixed(1)}%`);
    }

    // Cleanup
    await dataManager.cleanupTestData();

    // Exit with appropriate code
    if (summary.failed > 0) {
      console.log('\n❌ Some tests failed!');
      process.exit(1);
    } else {
      console.log('\n✅ All tests passed!');
      process.exit(0);
    }

  } catch (error) {
    console.error('\n❌ Test execution failed:', error.message);
    
    // Attempt cleanup
    try {
      await dataManager.cleanupTestData();
    } catch (cleanupError) {
      console.error('⚠️  Cleanup failed:', cleanupError.message);
    }
    
    process.exit(1);
  }
}

// Run tests
if (require.main === module) {
  main();
}

module.exports = {
  TestRunner,
  TestDataManager,
  ConsolidatedRPCTests,
  PerformanceBenchmark
};