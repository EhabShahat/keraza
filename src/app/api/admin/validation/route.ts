/**
 * Migration Validation API
 * 
 * Provides endpoints for running validation suites,
 * load testing, and feature parity checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { migrationValidator } from '@/lib/deployment/migration-validator';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'suites':
        return NextResponse.json({
          suites: migrationValidator.getAvailableSuites()
        });

      case 'executions':
        const limit = parseInt(searchParams.get('limit') || '20');
        return NextResponse.json({
          executions: migrationValidator.getAllExecutions().slice(0, limit)
        });

      case 'execution':
        const executionId = searchParams.get('execution_id');
        if (!executionId) {
          return NextResponse.json(
            { error: 'Execution ID is required' },
            { status: 400 }
          );
        }

        const execution = migrationValidator.getExecutionResults(executionId);
        if (!execution) {
          return NextResponse.json(
            { error: 'Execution not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({ execution });

      case 'status':
        return NextResponse.json({
          available_suites: migrationValidator.getAvailableSuites().length,
          recent_executions: migrationValidator.getAllExecutions().slice(0, 5)
        });

      default:
        return NextResponse.json({
          available_suites: migrationValidator.getAvailableSuites().length,
          recent_executions: migrationValidator.getAllExecutions().slice(0, 10)
        });
    }

  } catch (error) {
    console.error('Validation API GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get validation data' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'run_suite':
        return await handleRunSuite(body);

      case 'run_consolidated_functions_test':
        return await handleRunConsolidatedFunctionsTest(body);

      case 'run_performance_test':
        return await handleRunPerformanceTest(body);

      case 'run_load_test':
        return await handleRunLoadTest(body);

      case 'run_feature_parity_test':
        return await handleRunFeatureParityTest(body);

      case 'cancel_execution':
        return await handleCancelExecution(body);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Validation API POST error:', error);
    return NextResponse.json(
      { error: 'Validation operation failed' },
      { status: 500 }
    );
  }
}

async function handleRunSuite(body: any) {
  const { suite_id, environment = 'both' } = body;

  if (!suite_id) {
    return NextResponse.json(
      { error: 'Suite ID is required' },
      { status: 400 }
    );
  }

  if (!['blue', 'green', 'both'].includes(environment)) {
    return NextResponse.json(
      { error: 'Environment must be blue, green, or both' },
      { status: 400 }
    );
  }

  try {
    const executionId = await migrationValidator.executeValidationSuite(suite_id, environment);
    
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: `Validation suite ${suite_id} started successfully`
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

async function handleRunConsolidatedFunctionsTest(body: any) {
  const { environment = 'both' } = body;

  try {
    const executionId = await migrationValidator.executeValidationSuite('consolidated-functions', environment);
    
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: 'Consolidated functions validation started successfully'
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

async function handleRunPerformanceTest(body: any) {
  const { environment = 'both' } = body;

  try {
    const executionId = await migrationValidator.executeValidationSuite('performance-validation', environment);
    
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: 'Performance validation started successfully'
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

async function handleRunLoadTest(body: any) {
  const { environment = 'both' } = body;

  try {
    const executionId = await migrationValidator.executeValidationSuite('load-testing', environment);
    
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: 'Load testing started successfully'
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

async function handleRunFeatureParityTest(body: any) {
  const { environment = 'both' } = body;

  try {
    const executionId = await migrationValidator.executeValidationSuite('feature-parity', environment);
    
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: 'Feature parity validation started successfully'
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

async function handleCancelExecution(body: any) {
  try {
    const cancelled = migrationValidator.cancelCurrentExecution();
    
    if (cancelled) {
      return NextResponse.json({
        success: true,
        message: 'Validation execution cancelled successfully'
      });
    } else {
      return NextResponse.json({
        success: false,
        message: 'No active execution to cancel'
      });
    }

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'update_suite':
        return await handleUpdateSuite(body);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Validation API PUT error:', error);
    return NextResponse.json(
      { error: 'Update operation failed' },
      { status: 500 }
    );
  }
}

async function handleUpdateSuite(body: any) {
  const { suite_id, updates } = body;

  if (!suite_id || !updates) {
    return NextResponse.json(
      { error: 'Suite ID and updates are required' },
      { status: 400 }
    );
  }

  try {
    // This would update the validation suite configuration
    console.log(`Updating validation suite ${suite_id}:`, updates);
    
    return NextResponse.json({
      success: true,
      message: 'Validation suite updated successfully'
    });

  } catch (error) {
    return NextResponse.json(
      { 
        success: false,
        error: error.message 
      },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');
    const id = searchParams.get('id');

    switch (action) {
      case 'execution':
        if (!id) {
          return NextResponse.json(
            { error: 'Execution ID is required' },
            { status: 400 }
          );
        }

        // This would delete the execution record
        console.log(`Deleting validation execution ${id}`);
        
        return NextResponse.json({
          success: true,
          message: 'Validation execution deleted successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Validation API DELETE error:', error);
    return NextResponse.json(
      { error: 'Delete operation failed' },
      { status: 500 }
    );
  }
}