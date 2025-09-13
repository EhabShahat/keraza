import { NextRequest, NextResponse } from 'next/server';
import { ManualCacheInvalidation } from '@/lib/api/cache-invalidation';

/**
 * POST /api/cache/invalidate
 * Manually invalidate cache by type or pattern
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { type, pattern, entityType, entityId } = body;

    let result;

    if (type === 'all') {
      await ManualCacheInvalidation.invalidateAll();
      result = { message: 'All cache cleared' };
    } else if (type) {
      result = await ManualCacheInvalidation.invalidateByDataType(type);
    } else if (pattern) {
      const invalidated = ManualCacheInvalidation.invalidateByPattern(pattern);
      result = { invalidated, pattern };
    } else if (entityType && entityId) {
      result = await ManualCacheInvalidation.invalidateByEntity(entityType, entityId);
    } else {
      return NextResponse.json(
        { error: 'Invalid invalidation request' },
        { status: 400 }
      );
    }

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Failed to invalidate cache:', error);
    return NextResponse.json(
      { error: 'Failed to invalidate cache' },
      { status: 500 }
    );
  }
}