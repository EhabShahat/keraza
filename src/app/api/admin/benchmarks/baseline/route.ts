/**
 * API endpoint for managing performance baselines
 */

import { NextRequest, NextResponse } from 'next/server';
import { supabaseServer } from '@/lib/supabase/server';
import { BenchmarkMetrics } from '@/lib/benchmarking/performance-benchmarker';

export async function GET() {
  try {
    const supabase = supabaseServer();

    // Get the most recent baseline
    const { data, error } = await supabase
      .from('performance_baselines')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: 'No baseline found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data.metrics);
  } catch (error) {
    console.error('Error fetching baseline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch baseline' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = supabaseServer();
    const metrics: BenchmarkMetrics = await request.json();

    // Validate metrics
    if (!metrics || typeof metrics.responseTime !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metrics data' },
        { status: 400 }
      );
    }

    // Store baseline
    const { data, error } = await supabase
      .from('performance_baselines')
      .insert({
        metrics,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error storing baseline:', error);
    return NextResponse.json(
      { error: 'Failed to store baseline' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = supabaseServer();

    // Delete all baselines (for reset purposes)
    const { error } = await supabase
      .from('performance_baselines')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Baselines cleared' });
  } catch (error) {
    console.error('Error clearing baselines:', error);
    return NextResponse.json(
      { error: 'Failed to clear baselines' },
      { status: 500 }
    );
  }
}