/**
 * Deployment Management API
 * 
 * Provides endpoints for managing blue-green deployments,
 * health checks, and traffic routing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { DeploymentPipeline, DeploymentPlan } from '@/lib/deployment/deployment-pipeline';
import { DeploymentHealthChecker, defaultDeploymentHealthConfig } from '@/lib/deployment/health-checks';
import { trafficRouter } from '@/lib/deployment/traffic-router';
import { defaultDeploymentConfig } from '@/lib/deployment/blue-green-deployment';

// Initialize deployment services
const deploymentPipeline = new DeploymentPipeline(defaultDeploymentConfig);
const healthChecker = new DeploymentHealthChecker(defaultDeploymentHealthConfig);

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        return NextResponse.json({
          deployment_status: deploymentPipeline.getCurrentStatus(),
          health_status: healthChecker.getCurrentHealthStatus(),
          traffic_distribution: trafficRouter.getTrafficDistribution(),
          deployment_history: deploymentPipeline.getDeploymentHistory().slice(-10) // Last 10 deployments
        });

      case 'health':
        const healthStatus = healthChecker.getCurrentHealthStatus();
        return NextResponse.json(healthStatus);

      case 'traffic':
        return NextResponse.json({
          distribution: trafficRouter.getTrafficDistribution(),
          active_rules: trafficRouter.getActiveRules()
        });

      case 'history':
        const limit = parseInt(searchParams.get('limit') || '20');
        return NextResponse.json({
          deployments: deploymentPipeline.getDeploymentHistory().slice(-limit)
        });

      default:
        return NextResponse.json({
          deployment_status: deploymentPipeline.getCurrentStatus(),
          health_status: healthChecker.getCurrentHealthStatus(),
          traffic_distribution: trafficRouter.getTrafficDistribution()
        });
    }

  } catch (error) {
    console.error('Deployment API GET error:', error);
    return NextResponse.json(
      { error: 'Failed to get deployment status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { action } = body;

    switch (action) {
      case 'deploy':
        return await handleDeploy(body);

      case 'rollback':
        return await handleRollback(body);

      case 'traffic_shift':
        return await handleTrafficShift(body);

      case 'health_check':
        return await handleHealthCheck(body);

      case 'add_traffic_rule':
        return await handleAddTrafficRule(body);

      case 'emergency_stop':
        return await handleEmergencyStop(body);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Deployment API POST error:', error);
    return NextResponse.json(
      { error: 'Deployment operation failed' },
      { status: 500 }
    );
  }
}

async function handleDeploy(body: any) {
  const { version, functions, environment_variables, validation_suite } = body;

  if (!version || !functions) {
    return NextResponse.json(
      { error: 'Version and functions are required' },
      { status: 400 }
    );
  }

  const deploymentPlan: DeploymentPlan = {
    version,
    functions,
    environment_variables: environment_variables || {},
    rollback_plan: {
      trigger_conditions: [
        {
          metric: 'error_rate',
          threshold: 0.05,
          duration: 60,
          operator: 'gt'
        },
        {
          metric: 'response_time',
          threshold: 2000,
          duration: 120,
          operator: 'gt'
        }
      ],
      rollback_steps: [
        {
          order: 1,
          action: 'revert_traffic',
          parameters: {},
          timeout: 30000
        },
        {
          order: 2,
          action: 'notify_team',
          parameters: { severity: 'high' },
          timeout: 5000
        }
      ],
      data_consistency_checks: []
    },
    validation_suite: validation_suite || {
      pre_deployment: [],
      post_deployment: [],
      load_tests: [],
      integration_tests: []
    }
  };

  try {
    const result = await deploymentPipeline.executeDeployment(deploymentPlan);
    
    return NextResponse.json({
      success: true,
      deployment_id: result.deployment_id,
      result
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

async function handleRollback(body: any) {
  const { deployment_id, reason } = body;

  try {
    // This would trigger the actual rollback process
    console.log(`Triggering rollback for deployment ${deployment_id}: ${reason}`);
    
    // Reset traffic to blue environment (assuming it's the stable one)
    trafficRouter.setTrafficPercentage('blue', 100);
    
    return NextResponse.json({
      success: true,
      message: 'Rollback initiated successfully',
      deployment_id
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

async function handleTrafficShift(body: any) {
  const { from_environment, to_environment, percentage, gradual } = body;

  if (!from_environment || !to_environment || percentage === undefined) {
    return NextResponse.json(
      { error: 'from_environment, to_environment, and percentage are required' },
      { status: 400 }
    );
  }

  try {
    if (gradual) {
      const steps = [10, 25, 50, 75, 100];
      const intervalMs = 60000; // 1 minute between steps
      
      await trafficRouter.gradualTrafficShift(
        from_environment,
        to_environment,
        steps,
        intervalMs
      );
    } else {
      trafficRouter.setTrafficPercentage(to_environment, percentage);
    }

    return NextResponse.json({
      success: true,
      message: 'Traffic shift completed successfully',
      new_distribution: trafficRouter.getTrafficDistribution()
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

async function handleHealthCheck(body: any) {
  const { type = 'all' } = body;

  try {
    let result;

    switch (type) {
      case 'pre_deployment':
        result = await healthChecker.runPreDeploymentChecks();
        break;
      case 'post_deployment':
        result = await healthChecker.runPostDeploymentChecks();
        break;
      case 'current':
      case 'all':
      default:
        result = healthChecker.getCurrentHealthStatus();
        break;
    }

    return NextResponse.json({
      success: true,
      health_status: result
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

async function handleAddTrafficRule(body: any) {
  const { environment, percentage, conditions, priority } = body;

  if (!environment || percentage === undefined) {
    return NextResponse.json(
      { error: 'environment and percentage are required' },
      { status: 400 }
    );
  }

  try {
    const ruleId = trafficRouter.addRule({
      environment,
      percentage,
      conditions: conditions || [],
      priority: priority || 500,
      active: true
    });

    return NextResponse.json({
      success: true,
      rule_id: ruleId,
      message: 'Traffic rule added successfully'
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
    
    // Stop continuous monitoring
    healthChecker.stopContinuousMonitoring();
    
    // Reset traffic to blue environment (stable)
    trafficRouter.resetToDefault();
    
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
      case 'update_traffic_rule':
        return await handleUpdateTrafficRule(body);

      case 'toggle_health_check':
        return await handleToggleHealthCheck(body);

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Deployment API PUT error:', error);
    return NextResponse.json(
      { error: 'Update operation failed' },
      { status: 500 }
    );
  }
}

async function handleUpdateTrafficRule(body: any) {
  const { rule_id, updates } = body;

  if (!rule_id || !updates) {
    return NextResponse.json(
      { error: 'rule_id and updates are required' },
      { status: 400 }
    );
  }

  try {
    const success = trafficRouter.updateRule(rule_id, updates);
    
    if (!success) {
      return NextResponse.json(
        { error: 'Traffic rule not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      message: 'Traffic rule updated successfully'
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

async function handleToggleHealthCheck(body: any) {
  const { check_id, enabled } = body;

  if (!check_id || enabled === undefined) {
    return NextResponse.json(
      { error: 'check_id and enabled are required' },
      { status: 400 }
    );
  }

  try {
    // This would update the health check configuration
    console.log(`Toggling health check ${check_id}: ${enabled ? 'enabled' : 'disabled'}`);
    
    return NextResponse.json({
      success: true,
      message: `Health check ${enabled ? 'enabled' : 'disabled'} successfully`
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
      case 'traffic_rule':
        if (!id) {
          return NextResponse.json(
            { error: 'Rule ID is required' },
            { status: 400 }
          );
        }

        const success = trafficRouter.removeRule(id);
        
        if (!success) {
          return NextResponse.json(
            { error: 'Traffic rule not found' },
            { status: 404 }
          );
        }

        return NextResponse.json({
          success: true,
          message: 'Traffic rule removed successfully'
        });

      default:
        return NextResponse.json(
          { error: 'Unknown action' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Deployment API DELETE error:', error);
    return NextResponse.json(
      { error: 'Delete operation failed' },
      { status: 500 }
    );
  }
}