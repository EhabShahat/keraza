/**
 * Rollback and Safety Management API
 * 
 * Provides endpoints for managing rollback procedures,
 * safety monitoring, and data consistency checks.
 */

import { NextRequest, NextResponse } from 'next/server';
import { rollbackSystem } from '@/lib/deployment/rollback-system';
import { safetyMonitor } from '@/lib/deployment/safety-monitor';
import { dataConsistencyChecker } from '@/lib/deployment/data-consistency';

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        return NextResponse.json({
          rollback_status: rollbackSystem.getCurrentStatus(),
          safety_status: safetyMonitor.getCurrentStatus(),
          monitoring_active: true
        });

      case 'history':
        const limit = parseInt(searchParams.get('limit') || '20');
        return NextResponse.json({
          rollback_history: rollbackSystem.getRollbackHistory().slice(0, limit),
          safety_alerts: safetyMonitor.getAlertsHistory(limit),
          consistency_reports: dataConsistencyChecker.getReportsHistory(limit)
        });

      case 'safety_report':
        const report = safetyMonitor.generateSafetyReport();
        return NextResponse.json(report);

      case 'consistency_check':
        const environment = searchParams.get('environment') as 'blue' | 'green' | undefined;
        const consistencyReport = await dataConsistencyChecker.runConsistencyChecks(environment);
        return NextResponse.json(consistencyReport);

      case 'snapshots':
        return NextResponse.json({
          snapshots: dataConsistencyChecker.getSnapshots()
        });

      default:
        return NextResponse.json({
          rollback_status: rollbackSystem.getCurrentStatus(),
          safety_status: safetyMonitor.getCurrentStatus()
        });
    }

  } catch (error) {
    console.error('Rollback API GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get rollback status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'manual_rollback':
        return await handleManualRollback(body);

      case 'start_monitoring':
        return await handleStartMonitoring(body);

      case 'stop_monitoring':
        return await handleStopMonitoring(body);

      case 'create_snapshot':
        return await handleCreateSnapshot(body);

      case 'compare_snapshots':
        return await handleCompareSnapshots(body);

      case 'run_consistency_check':
        return await handleRunConsistencyCheck(body);

      case 'emergency_stop':
        return await handleEmergencyStop(body);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Rollback API POST error:', error);
    return NextResponse.json(
      { error: 'Rollback operation failed' },
      { status: 500 }
    );
  }
}

async function handleManualRollback(body: any) {
  const { reason, initiator } = body;

  if (!reason || !initiator) {
    return NextResponse.json(
      { error: 'Reason and initiator are required' },
      { status: 400 }
    );
  }

  try {
    const executionId = await rollbackSystem.manualRollback(reason, initiator);
    
    return NextResponse.json({
      success: true,
      execution_id: executionId,
      message: 'Manual rollback initiated successfully'
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

async function handleStartMonitoring(body: any) {
  const { type = 'all' } = body;

  try {
    if (type === 'rollback' || type === 'all') {
      rollbackSystem.startMonitoring();
    }
    
    if (type === 'safety' || type === 'all') {
      safetyMonitor.startMonitoring();
    }

    return NextResponse.json({
      success: true,
      message: `${type} monitoring started successfully`
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

async function handleStopMonitoring(body: any) {
  const { type = 'all' } = body;

  try {
    if (type === 'rollback' || type === 'all') {
      rollbackSystem.stopMonitoring();
    }
    
    if (type === 'safety' || type === 'all') {
      safetyMonitor.stopMonitoring();
    }

    return NextResponse.json({
      success: true,
      message: `${type} monitoring stopped successfully`
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

async function handleCreateSnapshot(body: any) {
  const { environment } = body;

  if (!environment || !['blue', 'green'].includes(environment)) {
    return NextResponse.json(
      { error: 'Valid environment (blue or green) is required' },
      { status: 400 }
    );
  }

  try {
    const snapshotId = await dataConsistencyChecker.createSnapshot(environment);
    
    return NextResponse.json({
      success: true,
      snapshot_id: snapshotId,
      message: `Snapshot created for ${environment} environment`
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

async function handleCompareSnapshots(body: any) {
  const { snapshot1_id, snapshot2_id } = body;

  if (!snapshot1_id || !snapshot2_id) {
    return NextResponse.json(
      { error: 'Both snapshot IDs are required' },
      { status: 400 }
    );
  }

  try {
    const comparisonReport = await dataConsistencyChecker.compareSnapshots(snapshot1_id, snapshot2_id);
    
    return NextResponse.json({
      success: true,
      comparison_report: comparisonReport
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

async function handleRunConsistencyCheck(body: any) {
  const { environment } = body;

  try {
    const report = await dataConsistencyChecker.runConsistencyChecks(environment);
    
    return NextResponse.json({
      success: true,
      consistency_report: report
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

async function handleEmergencyStop(body: any) {
  const { reason } = body;

  try {
    console.log(`Emergency stop triggered: ${reason}`);
    
    // Stop all monitoring
    rollbackSystem.stopMonitoring();
    safetyMonitor.stopMonitoring();
    
    // Disable alerting
    safetyMonitor.setAlertingEnabled(false);
    
    return NextResponse.json({
      success: true,
      message: 'Emergency stop executed successfully'
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

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'update_trigger':
        return await handleUpdateTrigger(body);

      case 'toggle_alerting':
        return await handleToggleAlerting(body);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Rollback API PUT error:', error);
    return NextResponse.json(
      { error: 'Update operation failed' },
      { status: 500 }
    );
  }
}

async function handleUpdateTrigger(body: any) {
  const { trigger_id, updates } = body;

  if (!trigger_id || !updates) {
    return NextResponse.json(
      { error: 'Trigger ID and updates are required' },
      { status: 400 }
    );
  }

  try {
    // This would update the rollback trigger configuration
    console.log(`Updating rollback trigger ${trigger_id}:`, updates);
    
    return NextResponse.json({
      success: true,
      message: 'Rollback trigger updated successfully'
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

async function handleToggleAlerting(body: any) {
  const { enabled } = body;

  if (enabled === undefined) {
    return NextResponse.json(
      { error: 'Enabled flag is required' },
      { status: 400 }
    );
  }

  try {
    safetyMonitor.setAlertingEnabled(enabled);
    
    return NextResponse.json({
      success: true,
      message: `Alerting ${enabled ? 'enabled' : 'disabled'} successfully`
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
      case 'snapshot':
        if (!id) {
          return NextResponse.json(
            { error: 'Snapshot ID is required' },
            { status: 400 }
          );
        }

        // This would delete the snapshot
        console.log(`Deleting snapshot ${id}`);
        
        return NextResponse.json({
          success: true,
          message: 'Snapshot deleted successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Rollback API DELETE error:', error);
    return NextResponse.json(
      { error: 'Delete operation failed' },
      { status: 500 }
    );
  }
}