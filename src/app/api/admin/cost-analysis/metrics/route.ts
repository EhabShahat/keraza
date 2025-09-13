/**
 * API endpoint for managing cost metrics
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { CostMetrics } from '@/lib/benchmarking/cost-analyzer';

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    const limit = parseInt(searchParams.get('limit') || '30');
    const days = parseInt(searchParams.get('days') || '7');

    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const { data, error } = await supabase
      .from('cost_metrics')
      .select('*')
      .gte('timestamp', startDate.toISOString())
      .order('timestamp', { ascending: false })
      .limit(limit);

    if (error) {
      throw error;
    }

    return NextResponse.json(data || []);
  } catch (error) {
    console.error('Error fetching cost metrics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch cost metrics' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient();
    const metrics: CostMetrics = await request.json();

    // Validate metrics
    if (!metrics || typeof metrics.functionInvocations !== 'number') {
      return NextResponse.json(
        { error: 'Invalid metrics data' },
        { status: 400 }
      );
    }

    // Store metrics
    const { data, error } = await supabase
      .from('cost_metrics')
      .insert({
        function_invocations: metrics.functionInvocations,
        execution_time: metrics.executionTime,
        memory_usage: metrics.memoryUsage,
        bandwidth_usage: metrics.bandwidthUsage,
        storage_usage: metrics.storageUsage,
        database_queries: metrics.databaseQueries,
        cache_operations: metrics.cacheOperations,
        timestamp: metrics.timestamp.toISOString()
      })
      .select()
      .single();

    if (error) {
      throw error;
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error storing cost metrics:', error);
    return NextResponse.json(
      { error: 'Failed to store cost metrics' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const supabase = createClient();
    const { searchParams } = new URL(request.url);
    
    const olderThan = searchParams.get('olderThan'); // ISO date string

    if (!olderThan) {
      return NextResponse.json(
        { error: 'Must specify olderThan parameter' },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from('cost_metrics')
      .delete()
      .lt('timestamp', olderThan);

    if (error) {
      throw error;
    }

    return NextResponse.json({ message: 'Old cost metrics deleted' });
  } catch (error) {
    console.error('Error deleting cost metrics:', error);
    return NextResponse.json(
      { error: 'Failed to delete cost metrics' },
      { status: 500 }
    );
  }
}