import { NextRequest, NextResponse } from 'next/server';
import { cacheManager } from '@/lib/api/cache-manager';

/**
 * GET /api/cache/stats
 * Get cache statistics across all tiers
 */
export async function GET(request: NextRequest) {
  try {
    const stats = cacheManager.getStats();
    
    return NextResponse.json(stats);
  } catch (error) {
    console.error('Failed to get cache stats:', error);
    return NextResponse.json(
      { error: 'Failed to get cache statistics' },
      { status: 500 }
    );
  }
}