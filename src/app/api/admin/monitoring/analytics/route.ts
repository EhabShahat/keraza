/**
 * Performance Analytics API Endpoint
 * Provides trend analysis and capacity planning data
 */

import { NextRequest, NextResponse } from 'next/server';
import { performanceAnalytics, PerformanceTrend } from '@/lib/monitoring/performance-analytics';
import { z } from 'zod';

// Validation schema for performance trend data
const PerformanceTrendSchema = z.object({
  timestamp: z.string().transform(str => new Date(str)),
  function_name: z.string(),
  response_time: z.number(),
  throughput: z.number(),
  error_rate: z.number(),
  memory_usage: z.number(),
  cpu_usage: z.number()
});

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const functionName = searchParams.get('function');
    const days = parseInt(searchParams.get('days') || '7');
    const includeCapacityPlan = searchParams.get('capacity') === 'true';
    const includeAnomalies = searchParams.get('anomalies') !== 'false';

    if (!functionName) {
      return NextResponse.json({
        error: 'Missing function name parameter'
      }, { status: 400 });
    }

    try {
      // Get trend analysis
      const trendAnalysis = performanceAnalytics.analyzeTrends(functionName, days);
      
      // Get capacity plan if requested
      let capacityPlan = null;
      if (includeCapacityPlan) {
        capacityPlan = performanceAnalytics.generateCapacityPlan(functionName);
      }

      // Get raw trend data
      const rawTrends = performanceAnalytics.getTrends(functionName, days * 24);

      const response = {
        trend_analysis: trendAnalysis,
        capacity_plan: capacityPlan,
        raw_trends: rawTrends,
        metadata: {
          function_name: functionName,
          period_days: days,
          data_points: rawTrends.length,
          analysis_timestamp: new Date().toISOString()
        }
      };

      return NextResponse.json(response);

    } catch (analysisError) {
      // Handle case where no data is available
      if (analysisError instanceof Error && analysisError.message.includes('No trend data available')) {
        return NextResponse.json({
          trend_analysis: null,
          capacity_plan: null,
          raw_trends: [],
          metadata: {
            function_name: functionName,
            period_days: days,
            data_points: 0,
            analysis_timestamp: new Date().toISOString()
          },
          message: 'No trend data available for the specified function and period'
        });
      }
      throw analysisError;
    }

  } catch (error) {
    console.error('Error getting performance analytics:', error);
    return NextResponse.json({
      error: 'Failed to get performance analytics',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Handle single trend or array of trends
    const trends = Array.isArray(body) ? body : [body];
    
    // Validate and record each trend
    for (const trendData of trends) {
      const validatedTrend = PerformanceTrendSchema.parse(trendData);
      performanceAnalytics.recordTrend(validatedTrend as PerformanceTrend);
    }

    return NextResponse.json({
      success: true,
      message: `Recorded ${trends.length} performance trend(s)`,
      count: trends.length
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid performance trend data',
        details: error.errors
      }, { status: 400 });
    }

    console.error('Error recording performance trends:', error);
    return NextResponse.json({
      error: 'Failed to record performance trends',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const days = parseInt(searchParams.get('days') || '30');

    // Clear old trend data
    performanceAnalytics.clearOldTrends(days);

    return NextResponse.json({
      success: true,
      message: `Cleared performance trends older than ${days} days`
    });

  } catch (error) {
    console.error('Error clearing performance trends:', error);
    return NextResponse.json({
      error: 'Failed to clear performance trends',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}