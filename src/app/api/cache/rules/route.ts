import { NextRequest, NextResponse } from 'next/server';
import { cacheInvalidationManager } from '@/lib/api/cache-invalidation';

/**
 * GET /api/cache/rules
 * Get cache invalidation rules
 */
export async function GET(request: NextRequest) {
  try {
    const rules = cacheInvalidationManager.getRules();
    
    return NextResponse.json(rules);
  } catch (error) {
    console.error('Failed to get cache rules:', error);
    return NextResponse.json(
      { error: 'Failed to get cache rules' },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/cache/rules
 * Update cache invalidation rule
 */
export async function PATCH(request: NextRequest) {
  try {
    const body = await request.json();
    const { ruleId, enabled } = body;

    if (!ruleId || typeof enabled !== 'boolean') {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }

    cacheInvalidationManager.setRuleEnabled(ruleId, enabled);
    
    return NextResponse.json({
      success: true,
      message: `Rule ${ruleId} ${enabled ? 'enabled' : 'disabled'}`
    });
  } catch (error) {
    console.error('Failed to update cache rule:', error);
    return NextResponse.json(
      { error: 'Failed to update cache rule' },
      { status: 500 }
    );
  }
}