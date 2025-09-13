/**
 * API endpoint for managing benchmark test results
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { BenchmarkResult } from '@/lib/benchmarking/performance-benchmarker';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '50');
    const testId = searchParams.get('testId');

    let query = supabase
      .from('benchmark_results')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(limit);

    if (testId) {
      query = query.eq('test_id', testId);
    }

    const { data, error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching benchmark results:', error);
    return NextResponse.json(
      { error: 'Failed to fetch benchmark results' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const results: BenchmarkResult[] = await request.json();

    // Validate results
    if (!Array.isArray(results) || results.length === 0) {
      return NextResponse.json(
        { error: 'Invalid results data' },
        { status: 400 }
      );
    }

    // Store results
    const insertData = results.map(result => ({
      test_id: result.testId,
      metrics: result.metrics,
      success: result.success,
      errors: result.errors,
      duration: result.duration,
      iterations: result.iterations,
      created_at: new Date().toISOString()
    }));

    const { data, error } = await supabase
      .from('benchmark_results')
      .insert(insertData)
      .select();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error storing benchmark results:', error);
    return NextResponse.json(
      { error: 'Failed to store benchmark results' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    const testId = searchParams.get('testId');
    const olderThan = searchParams.get('olderThan'); // ISO date string

    let query = supabase.from('benchmark_results').delete();

    if (testId) {
      query = query.eq('test_id', testId);
    } else if (olderThan) {
      query = query.lt('created_at', olderThan);
    } else {
      // Require specific criteria to prevent accidental deletion
      return NextResponse.json(
        { error: 'Must specify testId or olderThan parameter' },
        { status: 400 }
      );
    }

    const { error } = await query;

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Results deleted' });
  } catch (error) {
    console.error('Error deleting benchmark results:', error);
    return NextResponse.json(
      { error: 'Failed to delete benchmark results' },
      { status: 500 }
    );
  }
}