/**
 * API endpoint for running performance benchmarks
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceBenchmarker, BenchmarkTest } from '@/lib/benchmarking/performance-benchmarker';
import { loadTester, LoadTestScenario } from '@/lib/benchmarking/load-testing';
import { regressionDetector } from '@/lib/benchmarking/regression-detector';

export async function POST(request: NextRequest) {
  try {
    const { type, config } = await request.json();

    switch (type) {
      case 'baseline':
        return await runBaselineEstablishment();
      
      case 'benchmark':
        return await runBenchmarkSuite(config?.tests || []);
      
      case 'load-test':
        return await runLoadTest(config?.scenario);
      
      case 'regression-check':
        return await runRegressionCheck();
      
      default:
        return NextResponse.json(
          { error: 'Invalid benchmark type' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error running benchmark:', error);
    return NextResponse.json(
      { error: 'Failed to run benchmark' },
      { status: 500 }
    );
  }
}

async function runBaselineEstablishment() {
  try {
    const baseline = await performanceBenchmarker.establishBaseline();
    
    return NextResponse.json({
      type: 'baseline',
      success: true,
      data: baseline,
      message: 'Performance baseline established successfully'
    });
  } catch (error) {
    throw new Error(`Baseline establishment failed: ${error}`);
  }
}

async function runBenchmarkSuite(tests: BenchmarkTest[]) {
  try {
    // Use default tests if none provided
    const defaultTests: BenchmarkTest[] = [
      {
        id: 'admin-health',
        name: 'Admin Health Check',
        endpoint: '/api/admin/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        iterations: 10
      },
      {
        id: 'public-health',
        name: 'Public Health Check',
        endpoint: '/api/public/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        iterations: 10
      },
      {
        id: 'attempts-health',
        name: 'Attempts Health Check',
        endpoint: '/api/attempts/health',
        method: 'GET',
        expectedStatus: 200,
        timeout: 5000,
        iterations: 10
      }
    ];

    const testsToRun = tests.length > 0 ? tests : defaultTests;
    const results = await performanceBenchmarker.runBenchmarkSuite(testsToRun);
    
    return NextResponse.json({
      type: 'benchmark',
      success: true,
      data: results,
      message: `Benchmark suite completed with ${results.length} tests`
    });
  } catch (error) {
    throw new Error(`Benchmark suite failed: ${error}`);
  }
}

async function runLoadTest(scenarioName?: string) {
  try {
    const scenarios = loadTester.getScenarios();
    const scenario = scenarioName 
      ? scenarios.find(s => s.name === scenarioName)
      : scenarios[0]; // Default to first scenario

    if (!scenario) {
      throw new Error(`Load test scenario not found: ${scenarioName}`);
    }

    const result = await loadTester.runLoadTest(scenario);
    
    return NextResponse.json({
      type: 'load-test',
      success: true,
      data: result,
      message: `Load test completed: ${scenario.name}`
    });
  } catch (error) {
    throw new Error(`Load test failed: ${error}`);
  }
}

async function runRegressionCheck() {
  try {
    // Get baseline
    const baseline = await performanceBenchmarker.getBaseline();
    if (!baseline) {
      throw new Error('No baseline available for regression check');
    }

    // Get current metrics
    const currentMetrics = await performanceBenchmarker.getCurrentMetrics();
    
    // Compare with baseline
    const comparison = await performanceBenchmarker.compareWithBaseline(currentMetrics);
    
    // Analyze for regressions
    const regressionReport = regressionDetector.analyzePerformance(comparison);
    
    // Send alerts if needed
    if (regressionReport.alerts.length > 0) {
      await regressionDetector.sendAlertNotifications(regressionReport.alerts);
    }
    
    return NextResponse.json({
      type: 'regression-check',
      success: true,
      data: {
        comparison,
        regressionReport
      },
      message: `Regression check completed: ${regressionReport.overallStatus} status`
    });
  } catch (error) {
    throw new Error(`Regression check failed: ${error}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'scenarios':
        const scenarios = loadTester.getScenarios();
        return NextResponse.json({
          scenarios: scenarios.map(s => ({
            name: s.name,
            description: s.description,
            duration: s.duration,
            concurrentUsers: s.concurrentUsers
          }))
        });

      case 'active-tests':
        const activeTests = loadTester.getActiveTests();
        return NextResponse.json({ activeTests });

      case 'thresholds':
        const thresholds = regressionDetector.getThresholds();
        return NextResponse.json({ thresholds });

      case 'alerts':
        const alerts = regressionDetector.getActiveAlerts();
        return NextResponse.json({ alerts });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling benchmark GET request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const testId = searchParams.get('testId');

    switch (action) {
      case 'stop-load-test':
        if (testId) {
          loadTester.stopLoadTest(testId);
        } else {
          loadTester.stopAllLoadTests();
        }
        return NextResponse.json({ message: 'Load test(s) stopped' });

      case 'clear-alerts':
        regressionDetector.clearResolvedAlerts();
        return NextResponse.json({ message: 'Resolved alerts cleared' });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling benchmark DELETE request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}