import { NextRequest, NextResponse } from 'next/server';
import { functionRegistry } from '@/lib/audit/function-registry';
import { performanceMonitor } from '@/lib/audit/performance-monitor';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action') || 'dashboard';

    switch (action) {
      case 'dashboard':
        const dashboardData = await functionRegistry.getDashboardData();
        return NextResponse.json(dashboardData);

      case 'functions':
        const status = searchParams.get('status');
        const functions = status 
          ? await functionRegistry.getFunctionsByStatus(status as any)
          : await functionRegistry.getAllFunctions();
        return NextResponse.json(functions);

      case 'consolidation-plans':
        const plans = await functionRegistry.getConsolidationPlans();
        return NextResponse.json(plans);

      case 'recommendations':
        const recStatus = searchParams.get('status');
        const recommendations = await functionRegistry.getRecommendations(recStatus as any);
        return NextResponse.json(recommendations);

      case 'performance-baseline':
        try {
          const baseline = performanceMonitor.calculateBaseline();
          return NextResponse.json(baseline);
        } catch (error) {
          // If no metrics available, return empty baseline
          return NextResponse.json({
            timestamp: new Date().toISOString(),
            averageResponseTime: 0,
            memoryUsage: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 },
            functionCount: 0,
            errorRate: 0,
            throughput: 0
          });
        }

      case 'performance-report':
        try {
          const report = performanceMonitor.generateReport();
          return NextResponse.json(report);
        } catch (error) {
          return NextResponse.json({
            summary: {
              timestamp: new Date().toISOString(),
              averageResponseTime: 0,
              memoryUsage: { rss: 0, heapUsed: 0, heapTotal: 0, external: 0 },
              functionCount: 0,
              errorRate: 0,
              throughput: 0
            },
            functionBreakdown: [],
            slowestFunctions: [],
            recommendations: ['No performance data available. Run function analysis first.']
          });
        }

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Optimization API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'create-consolidation-plan':
        const { consolidation_name, category, target_handler_path, function_names } = body;
        const planId = await functionRegistry.createConsolidationPlan({
          consolidation_name,
          category,
          target_handler_path,
          function_names
        });
        return NextResponse.json({ id: planId });

      case 'update-function-status':
        const { function_id, status } = body;
        await functionRegistry.updateFunctionStatus(function_id, status);
        return NextResponse.json({ success: true });

      case 'update-consolidation-plan':
        const { plan_id, updates } = body;
        await functionRegistry.updateConsolidationPlan(plan_id, updates);
        return NextResponse.json({ success: true });

      case 'add-recommendation':
        const recommendation = body.recommendation;
        const recId = await functionRegistry.addRecommendation(recommendation);
        return NextResponse.json({ id: recId });

      case 'update-recommendation':
        const { recommendation_id, rec_status, notes } = body;
        await functionRegistry.updateRecommendationStatus(recommendation_id, rec_status, notes);
        return NextResponse.json({ success: true });

      case 'record-baseline':
        const baseline = body.baseline;
        const baselineId = await functionRegistry.recordPerformanceBaseline(baseline);
        return NextResponse.json({ id: baselineId });

      case 'simulate-baseline':
        const { function_names: simulationFunctionNames } = body;
        const simulatedBaseline = await performanceMonitor.simulateBaseline(simulationFunctionNames);
        
        // Record the simulated baseline
        const recordedId = await functionRegistry.recordPerformanceBaseline({
          baseline_type: 'initial',
          total_functions: simulatedBaseline.functionCount,
          avg_response_time_ms: simulatedBaseline.averageResponseTime,
          memory_usage_mb: simulatedBaseline.memoryUsage.heapUsed / (1024 * 1024),
          error_rate_percent: simulatedBaseline.errorRate,
          throughput_rpm: simulatedBaseline.throughput,
          consolidation_potential_percent: Math.min(80, simulatedBaseline.functionCount * 1.5),
          notes: 'Simulated baseline for optimization planning'
        });

        return NextResponse.json({ 
          baseline: simulatedBaseline,
          baseline_id: recordedId
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }
  } catch (error) {
    console.error('Optimization API POST error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}