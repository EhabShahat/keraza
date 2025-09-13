import { NextRequest, NextResponse } from 'next/server';
import { CacheAnalyticsCollector } from '@/lib/api/cache-analytics';

/**
 * GET /api/cache/analytics
 * Get comprehensive cache analytics
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    
    let timeRange;
    if (startDate && endDate) {
      timeRange = {
        start: new Date(startDate),
        end: new Date(endDate)
      };
    }
    
    const analytics = CacheAnalyticsCollector.getAnalytics(timeRange);
    
    return NextResponse.json(analytics);
  } catch (error) {
    console.error('Failed to get cache analytics:', error);
    return NextResponse.json(
      { error: 'Failed to get cache analytics' },
      { status: 500 }
    );
  }
}