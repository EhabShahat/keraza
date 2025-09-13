/**
 * API endpoint for success metrics validation
 */

import { NextRequest, NextResponse } from 'next/server';
import { successValidator } from '@/lib/benchmarking/success-validator';
import { performanceBenchmarker } from '@/lib/benchmarking/performance-benchmarker';
import { costAnalyzer } from '@/lib/benchmarking/cost-analyzer';

export async function POST(request: NextRequest) {
  try {
    const { action, includeFeatureParity = true } = await request.json();

    switch (action) {
      case 'validate-all':
        return await validateAllCriteria(includeFeatureParity);
      
      case 'validate-performance':
        return await validatePerformanceOnly();
      
      case 'validate-cost':
        return await validateCostOnly();
      
      case 'validate-feature-parity':
        return await validateFeatureParityOnly();
      
      case 'get-criteria':
        return await getCriteria();
      
      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error in success validation:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Validation failed' },
      { status: 500 }
    );
  }
}

async function validateAllCriteria(includeFeatureParity: boolean) {
  try {
    // Get performance comparison
    const baseline = await performanceBenchmarker.getBaseline();
    let performanceComparison = null;
    
    if (baseline) {
      const currentMetrics = await performanceBenchmarker.collectSystemMetrics();
      performanceComparison = await performanceBenchmarker.compareWithBaseline(currentMetrics);
    }

    // Get cost comparison
    const costBaseline = costAnalyzer.getBaselineCosts();
    let costComparison = null;
    
    if (costBaseline) {
      const currentCosts = await costAnalyzer.calculateCurrentCosts();
      costComparison = {
        baseline: costBaseline,
        current: currentCosts
      };
    }

    // Get ROI analysis
    let roiAnalysis = null;
    if (costBaseline) {
      roiAnalysis = await costAnalyzer.calculateROI(5000, '30-day'); // Example optimization cost
    }

    // Run validation
    const report = await successValidator.validateSuccess(
      performanceComparison || undefined,
      costComparison || undefined,
      roiAnalysis || undefined
    );

    return NextResponse.json({
      success: true,
      data: report,
      message: `Validation completed: ${report.overallSuccess ? 'PASSED' : 'FAILED'}`
    });
  } catch (error) {
    throw new Error(`Full validation failed: ${error}`);
  }
}

async function validatePerformanceOnly() {
  try {
    const baseline = await performanceBenchmarker.getBaseline();
    
    if (!baseline) {
      return NextResponse.json(
        { error: 'No performance baseline available' },
        { status: 400 }
      );
    }

    const currentMetrics = await performanceBenchmarker.collectSystemMetrics();
    const comparison = await performanceBenchmarker.compareWithBaseline(currentMetrics);
    
    const report = await successValidator.validateSuccess(comparison);

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Performance validation completed'
    });
  } catch (error) {
    throw new Error(`Performance validation failed: ${error}`);
  }
}

async function validateCostOnly() {
  try {
    const baseline = costAnalyzer.getBaselineCosts();
    
    if (!baseline) {
      return NextResponse.json(
        { error: 'No cost baseline available' },
        { status: 400 }
      );
    }

    const currentCosts = await costAnalyzer.calculateCurrentCosts();
    const costComparison = {
      baseline,
      current: currentCosts
    };

    const roiAnalysis = await costAnalyzer.calculateROI(5000, '30-day');
    
    const report = await successValidator.validateSuccess(
      undefined,
      costComparison,
      roiAnalysis
    );

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Cost validation completed'
    });
  } catch (error) {
    throw new Error(`Cost validation failed: ${error}`);
  }
}

async function validateFeatureParityOnly() {
  try {
    const featureResults = await successValidator.validateFeatureParity();
    
    const report = {
      timestamp: new Date(),
      overallSuccess: featureResults.every(r => r.passed),
      successRate: (featureResults.filter(r => r.passed).length / featureResults.length) * 100,
      results: featureResults,
      summary: {
        total: featureResults.length,
        passed: featureResults.filter(r => r.passed).length,
        failed: featureResults.filter(r => !r.passed).length
      }
    };

    return NextResponse.json({
      success: true,
      data: report,
      message: 'Feature parity validation completed'
    });
  } catch (error) {
    throw new Error(`Feature parity validation failed: ${error}`);
  }
}

async function getCriteria() {
  try {
    const criteria = successValidator.getSuccessCriteria();
    const featureTests = successValidator.getFeatureParityTests();

    return NextResponse.json({
      success: true,
      data: {
        successCriteria: criteria,
        featureParityTests: featureTests
      },
      message: 'Success criteria retrieved'
    });
  } catch (error) {
    throw new Error(`Failed to get criteria: ${error}`);
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const type = searchParams.get('type');

    switch (type) {
      case 'criteria':
        const criteria = successValidator.getSuccessCriteria();
        return NextResponse.json({ criteria });

      case 'feature-tests':
        const tests = successValidator.getFeatureParityTests();
        return NextResponse.json({ tests });

      case 'summary':
        // Get a quick summary of validation status
        const criteriaCount = successValidator.getSuccessCriteria().length;
        const testCount = successValidator.getFeatureParityTests().length;
        
        return NextResponse.json({
          summary: {
            totalCriteria: criteriaCount,
            totalFeatureTests: testCount,
            categories: {
              performance: successValidator.getSuccessCriteria().filter(c => c.category === 'performance').length,
              cost: successValidator.getSuccessCriteria().filter(c => c.category === 'cost').length,
              reliability: successValidator.getSuccessCriteria().filter(c => c.category === 'reliability').length,
              scalability: successValidator.getSuccessCriteria().filter(c => c.category === 'scalability').length,
              feature_parity: testCount
            }
          }
        });

      default:
        return NextResponse.json(
          { error: 'Invalid type parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling validation GET request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}