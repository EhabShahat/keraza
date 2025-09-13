import { NextRequest, NextResponse } from 'next/server';
import { cacheConsistencyChecker, CacheRepairUtilities } from '@/lib/api/cache-consistency';

/**
 * GET /api/cache/consistency
 * Run cache consistency check
 */
export async function GET(request: NextRequest) {
  try {
    const result = await cacheConsistencyChecker.runConsistencyCheck();
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('Failed to run consistency check:', error);
    return NextResponse.json(
      { error: 'Failed to run consistency check' },
      { status: 500 }
    );
  }
}

/**
 * POST /api/cache/consistency
 * Auto-fix consistency issues or perform repair operations
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action, issues } = body;

    let result;

    switch (action) {
      case 'auto-fix':
        if (!issues || !Array.isArray(issues)) {
          return NextResponse.json(
            { error: 'Issues array required for auto-fix' },
            { status: 400 }
          );
        }
        result = await CacheRepairUtilities.autoFixIssues(issues);
        break;

      case 'comprehensive-repair':
        result = await CacheRepairUtilities.performComprehensiveRepair();
        break;

      case 'repair-key':
        const { cacheKey } = body;
        if (!cacheKey) {
          return NextResponse.json(
            { error: 'Cache key required for repair' },
            { status: 400 }
          );
        }
        await CacheRepairUtilities.repairCacheFromSource(cacheKey);
        result = { message: `Repaired cache for key: ${cacheKey}` };
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid action' },
          { status: 400 }
        );
    }

    return NextResponse.json({
      success: true,
      ...result
    });
  } catch (error) {
    console.error('Failed to perform cache repair:', error);
    return NextResponse.json(
      { error: 'Failed to perform cache repair' },
      { status: 500 }
    );
  }
}