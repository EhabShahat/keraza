/**
 * Cost Analysis API Endpoint
 * Provides cost tracking and optimization recommendations
 */

import { NextRequest, NextResponse } from 'next/server';
import { costTracker } from '@/lib/monitoring/cost-tracker';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const hours = parseInt(searchParams.get('hours') || '24');
    const includeRecommendations = searchParams.get('recommendations') !== 'false';

    // Get cost analysis
    const analysis = costTracker.getCostAnalysis(hours);

    // Get function-specific metrics if requested
    const functionName = searchParams.get('function');
    let functionMetrics = null;
    if (functionName) {
      functionMetrics = costTracker.getFunctionMetrics(functionName, hours);
    }

    // Calculate optimization impact
    const optimizationImpact = costTracker.getCostComparison(63, 25); // Before/after consolidation

    const response = {
      analysis,
      optimization_impact: optimizationImpact,
      function_metrics: functionMetrics,
      period: {
        hours,
        start: new Date(Date.now() - hours * 60 * 60 * 1000).toISOString(),
        end: new Date().toISOString()
      },
      timestamp: new Date().toISOString()
    };

    return NextResponse.json(response);

  } catch (error) {
    console.error('Error getting cost analysis:', error);
    return NextResponse.json({
      error: 'Failed to get cost analysis',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { function_name, invocations, execution_time_ms, memory_usage_mb } = body;

    // Validate required fields
    if (!function_name || typeof invocations !== 'number' || typeof execution_time_ms !== 'number' || typeof memory_usage_mb !== 'number') {
      return NextResponse.json({
        error: 'Missing required fields: function_name, invocations, execution_time_ms, memory_usage_mb'
      }, { status: 400 });
    }

    // Record the metrics
    costTracker.recordMetrics(function_name, invocations, execution_time_ms, memory_usage_mb);

    return NextResponse.json({
      success: true,
      message: 'Cost metrics recorded successfully'
    });

  } catch (error) {
    console.error('Error recording cost metrics:', error);
    return NextResponse.json({
      error: 'Failed to record cost metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Clear old metrics
    costTracker.clearOldMetrics(days);

    return NextResponse.json({
      success: true,
      message: `Cleared metrics older than ${days} days`
    });

  } catch (error) {
    console.error('Error clearing cost metrics:', error);
    return NextResponse.json({
      error: 'Failed to clear cost metrics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}