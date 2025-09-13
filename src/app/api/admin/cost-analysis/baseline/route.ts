/**
 * API endpoint for managing cost baselines
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CostBreakdown } from '@/lib/benchmarking/cost-analyzer';

export async function GET() {
  try {
    const supabase = createClient();

    // Get the most recent cost baseline
    const { data, error } = await supabase
      .from('cost_baselines')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') {
      throw error;
    }

    if (!data) {
      return NextResponse.json(
        { error: 'No cost baseline found' },
        { status: 404 }
      );
    }

    return NextResponse.json(data.breakdown);
  } catch (error) {
    console.error('Error fetching cost baseline:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost baseline' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const breakdown: CostBreakdown = await request.json();

    // Validate breakdown
    if (!breakdown || typeof breakdown.totalCost !== 'number') {
      return NextResponse.json(
        { error: 'Invalid cost breakdown data' },
        { status: 400 }
      );
    }

    // Store baseline
    const { data, error } = await supabase
      .from('cost_baselines')
      .insert({
        breakdown,
        total_cost: breakdown.totalCost,
        created_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error storing cost baseline:', error);
    return NextResponse.json(
      { error: 'Failed to store cost baseline' },
      { status: 500 }
    );
  }
}

export async function DELETE() {
  try {
    const supabase = createClient();

    // Delete all baselines (for reset purposes)
    const { error } = await supabase
      .from('cost_baselines')
      .delete()
      .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Cost baselines cleared' });
  } catch (error) {
    console.error('Error clearing cost baselines:', error);
    return NextResponse.json(
      { error: 'Failed to clear cost baselines' },
      { status: 500 }
    );
  }
}