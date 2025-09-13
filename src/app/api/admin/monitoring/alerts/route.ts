/**
 * Alert Management API Endpoint
 * Manages alert rules and configurations
 */

import { NextRequest, NextResponse } from 'next/server';
import { alertingSystem, AlertRule } from '@/lib/monitoring/alerting-system';
import { z } from 'zod';

// Validation schemas
const AlertRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  condition: z.object({
    metric: z.enum(['response_time', 'error_rate', 'success_rate', 'memory_usage', 'status']),
    operator: z.enum(['gt', 'lt', 'eq', 'gte', 'lte']),
    threshold: z.union([z.number(), z.string()]),
    duration: z.number()
  }),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  enabled: z.boolean(),
  cooldown: z.number(),
  channels: z.array(z.object({
    type: z.enum(['console', 'webhook', 'email', 'slack']),
    config: z.record(z.any())
  }))
});

export async function GET(request: NextRequest) {
  try {
    const rules = alertingSystem.getRules();
    const activeAlerts = alertingSystem.getActiveAlerts();
    const allAlerts = alertingSystem.getAllAlerts();

    // Group alerts by severity
    const alertsBySeverity = {
      critical: allAlerts.filter(a => a.severity === 'critical'),
      high: allAlerts.filter(a => a.severity === 'high'),
      medium: allAlerts.filter(a => a.severity === 'medium'),
      low: allAlerts.filter(a => a.severity === 'low')
    };

    return NextResponse.json({
      rules,
      active_alerts: activeAlerts,
      alerts_by_severity: alertsBySeverity,
      statistics: {
        total_rules: rules.length,
        enabled_rules: rules.filter(r => r.enabled).length,
        active_alerts: activeAlerts.length,
        total_alerts: allAlerts.length
      }
    });

  } catch (error) {
    console.error('Error getting alert rules:', error);
    return NextResponse.json({
      error: 'Failed to get alert rules',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the alert rule
    const validatedRule = AlertRuleSchema.parse(body);
    
    // Add the rule to the alerting system
    alertingSystem.addRule(validatedRule as AlertRule);
    
    return NextResponse.json({
      success: true,
      message: 'Alert rule created successfully',
      rule: validatedRule
    }, { status: 201 });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid alert rule data',
        details: error.errors
      }, { status: 400 });
    }

    console.error('Error creating alert rule:', error);
    return NextResponse.json({
      error: 'Failed to create alert rule',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  try {
    const body = await request.json();
    
    // Validate the alert rule
    const validatedRule = AlertRuleSchema.parse(body);
    
    // Update the rule in the alerting system
    alertingSystem.updateRule(validatedRule as AlertRule);
    
    return NextResponse.json({
      success: true,
      message: 'Alert rule updated successfully',
      rule: validatedRule
    });

  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({
        error: 'Invalid alert rule data',
        details: error.errors
      }, { status: 400 });
    }

    console.error('Error updating alert rule:', error);
    return NextResponse.json({
      error: 'Failed to update alert rule',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');
    
    if (!ruleId) {
      return NextResponse.json({
        error: 'Missing rule ID'
      }, { status: 400 });
    }
    
    // Remove the rule from the alerting system
    alertingSystem.removeRule(ruleId);
    
    return NextResponse.json({
      success: true,
      message: 'Alert rule deleted successfully'
    });

  } catch (error) {
    console.error('Error deleting alert rule:', error);
    return NextResponse.json({
      error: 'Failed to delete alert rule',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}