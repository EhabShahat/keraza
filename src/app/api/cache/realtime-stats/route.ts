import { NextRequest, NextResponse } from 'next/server';
import { CacheAnalyticsCollector } from '@/lib/api/cache-analytics';

/**
 * GET /api/cache/realtime-stats
 * Get real-time cache statistics
 */
export async function GET(request: NextRequest) {
  try {
    const stats = CacheAnalyticsCollector.getRealTimeStats();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get real-time cache stats:', error);
    return NextResponse.json(
      { error: 'Failed to get real-time cache statistics' },
      { status: 500 }
    );
  }
}