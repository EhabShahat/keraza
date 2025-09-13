/**
 * Auto-Recovery Management API
 * Provides endpoints for managing automated recovery and scaling
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin';
import { 
  autoRecoverySystem, 
  defaultRecoveryConfigs, 
  defaultLoadBalancingConfigs, 
  defaultScalingConfigs,
  RecoveryConfig,
  LoadBalancingConfig,
  ScalingConfig
} from '@/lib/monitoring/auto-recovery';
import { loadBalancer } from '@/lib/monitoring/load-balancer';

export async function GET(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const functionName = searchParams.get('function');
    const action = searchParams.get('action');

    switch (action) {
      case 'status':
        if (functionName) {
          const circuitBreaker = autoRecoverySystem.getCircuitBreakerState(functionName);
          const instances = autoRecoverySystem.getFunctionInstances(functionName);
          const activeRequests = loadBalancer.getActiveRequestsForFunction(functionName);
          
          return NextResponse.json({
            function_name: functionName,
            circuit_breaker: circuitBreaker,
            instances: instances,
            active_requests: activeRequests.length,
            session_affinities: Object.fromEntries(loadBalancer.getSessionAffinities())
          });
        } else {
          // Return status for all functions
          const allStatus = ['admin', 'public', 'attempts'].map(fn => ({
            function_name: fn,
            circuit_breaker: autoRecoverySystem.getCircuitBreakerState(fn),
            instances: autoRecoverySystem.getFunctionInstances(fn),
            active_requests: loadBalancer.getActiveRequestsForFunction(fn).length
          }));
          
          return NextResponse.json({
            functions: allStatus,
            total_active_requests: loadBalancer.getActiveRequestCount()
          });
        }

      case 'instances':
        if (functionName) {
          const instances = autoRecoverySystem.getFunctionInstances(functionName);
          return NextResponse.json({ instances });
        } else {
          const allInstances = ['admin', 'public', 'attempts'].reduce((acc, fn) => {
            acc[fn] = autoRecoverySystem.getFunctionInstances(fn);
            return acc;
          }, {} as Record<string, any>);
          
          return NextResponse.json(allInstances);
        }

      case 'circuit-breakers':
        if (functionName) {
          const circuitBreaker = autoRecoverySystem.getCircuitBreakerState(functionName);
          return NextResponse.json({ circuit_breaker: circuitBreaker });
        } else {
          const allCircuitBreakers = ['admin', 'public', 'attempts'].reduce((acc, fn) => {
            acc[fn] = autoRecoverySystem.getCircuitBreakerState(fn);
            return acc;
          }, {} as Record<string, any>);
          
          return NextResponse.json(allCircuitBreakers);
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: status, instances, or circuit-breakers' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Auto-recovery status error:', error);
    return NextResponse.json(
      { error: 'Failed to get auto-recovery status' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { action, function_name, config } = body;

    if (!action || !function_name) {
      return NextResponse.json(
        { error: 'Missing required fields: action, function_name' },
        { status: 400 }
      );
    }

    switch (action) {
      case 'initialize':
        const recoveryConfig: RecoveryConfig = config?.recovery || defaultRecoveryConfigs[function_name];
        const loadBalancingConfig: LoadBalancingConfig = config?.load_balancing || defaultLoadBalancingConfigs[function_name];
        const scalingConfig: ScalingConfig = config?.scaling || defaultScalingConfigs[function_name];

        if (!recoveryConfig || !loadBalancingConfig || !scalingConfig) {
          return NextResponse.json(
            { error: 'Invalid function name or missing configuration' },
            { status: 400 }
          );
        }

        autoRecoverySystem.initializeFunction(
          function_name,
          recoveryConfig,
          loadBalancingConfig,
          scalingConfig
        );

        return NextResponse.json({
          message: `Auto-recovery initialized for ${function_name}`,
          config: {
            recovery: recoveryConfig,
            load_balancing: loadBalancingConfig,
            scaling: scalingConfig
          }
        });

      case 'failover':
        await autoRecoverySystem.manualFailover(function_name);
        return NextResponse.json({
          message: `Manual failover triggered for ${function_name}`
        });

      case 'scale':
        const scaleAction = body.scale_action; // 'up' or 'down'
        if (!scaleAction || !['up', 'down'].includes(scaleAction)) {
          return NextResponse.json(
            { error: 'Invalid scale_action. Use: up or down' },
            { status: 400 }
          );
        }

        await autoRecoverySystem.manualScale(function_name, scaleAction);
        return NextResponse.json({
          message: `Manual scaling ${scaleAction} triggered for ${function_name}`
        });

      case 'stop':
        autoRecoverySystem.stopMonitoring(function_name);
        return NextResponse.json({
          message: `Auto-recovery stopped for ${function_name}`
        });

      case 'clear-sessions':
        if (body.session_id) {
          loadBalancer.clearSessionAffinity(body.session_id);
          return NextResponse.json({
            message: `Session affinity cleared for ${body.session_id}`
          });
        } else {
          loadBalancer.clearAllSessionAffinities();
          return NextResponse.json({
            message: 'All session affinities cleared'
          });
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: initialize, failover, scale, stop, or clear-sessions' },
          { status: 400 }
        );
    }

  } catch (error) {
    console.error('Auto-recovery management error:', error);
    return NextResponse.json(
      { error: 'Failed to manage auto-recovery' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    await requireAdmin(request);

    const body = await request.json();
    const { function_name, config } = body;

    if (!function_name || !config) {
      return NextResponse.json(
        { error: 'Missing required fields: function_name, config' },
        { status: 400 }
      );
    }

    // Stop current monitoring
    autoRecoverySystem.stopMonitoring(function_name);

    // Reinitialize with new config
    const recoveryConfig: RecoveryConfig = config.recovery || defaultRecoveryConfigs[function_name];
    const loadBalancingConfig: LoadBalancingConfig = config.load_balancing || defaultLoadBalancingConfigs[function_name];
    const scalingConfig: ScalingConfig = config.scaling || defaultScalingConfigs[function_name];

    autoRecoverySystem.initializeFunction(
      function_name,
      recoveryConfig,
      loadBalancingConfig,
      scalingConfig
    );

    return NextResponse.json({
      message: `Auto-recovery configuration updated for ${function_name}`,
      config: {
        recovery: recoveryConfig,
        load_balancing: loadBalancingConfig,
        scaling: scalingConfig
      }
    });

  } catch (error) {
    console.error('Auto-recovery configuration update error:', error);
    return NextResponse.json(
      { error: 'Failed to update auto-recovery configuration' },
      { status: 500 }
    );
  }
}

export async function DELETE(request: NextRequest) {
  try {
    await requireAdmin(request);

    const { searchParams } = new URL(request.url);
    const functionName = searchParams.get('function');

    if (!functionName) {
      return NextResponse.json(
        { error: 'Missing function name parameter' },
        { status: 400 }
      );
    }

    autoRecoverySystem.stopMonitoring(functionName);

    return NextResponse.json({
      message: `Auto-recovery disabled for ${functionName}`
    });

  } catch (error) {
    console.error('Auto-recovery disable error:', error);
    return NextResponse.json(
      { error: 'Failed to disable auto-recovery' },
      { status: 500 }
    );
  }
}