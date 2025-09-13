/**
 * API endpoint for ROI analysis and cost projections
 */

import { NextRequest, NextResponse } from 'next/server';
import { costAnalyzer } from '@/lib/benchmarking/cost-analyzer';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const timeframe = searchParams.get('timeframe') as 'monthly' | 'quarterly' | 'yearly' || 'monthly';

    switch (action) {
      case 'projections':
        const projections = costAnalyzer.generateCostProjections(timeframe);
        return NextResponse.json({ projections });

      case 'recommendations':
        const recommendations = costAnalyzer.generateOptimizationRecommendations();
        return NextResponse.json({ recommendations });

      case 'history':
        const history = costAnalyzer.getCostHistory();
        return NextResponse.json({ history });

      case 'baseline':
        const baseline = costAnalyzer.getBaselineCosts();
        return NextResponse.json({ baseline });

      default:
        return NextResponse.json(
          { error: 'Invalid action parameter' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling ROI GET request:', error);
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const { action, optimizationCost, period } = await request.json();

    switch (action) {
      case 'calculate-roi':
        const roi = await costAnalyzer.calculateROI(optimizationCost || 0, period || '30-day');
        return NextResponse.json({
          success: true,
          data: roi,
          message: 'ROI analysis completed'
        });

      case 'establish-baseline':
        const baseline = await costAnalyzer.establishCostBaseline();
        return NextResponse.json({
          success: true,
          data: baseline,
          message: 'Cost baseline established'
        });

      case 'track-metrics':
        await costAnalyzer.trackCostMetrics();
        return NextResponse.json({
          success: true,
          message: 'Cost metrics tracked'
        });

      case 'current-costs':
        const currentCosts = await costAnalyzer.calculateCurrentCosts();
        return NextResponse.json({
          success: true,
          data: currentCosts,
          message: 'Current costs calculated'
        });

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }
  } catch (error) {
    console.error('Error handling ROI POST request:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to process request' },
      { status: 500 }
    );
  }
}