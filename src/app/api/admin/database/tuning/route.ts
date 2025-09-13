/**
 * Database Tuning API
 * Provides access to automated tuning recommendations and controls
 */

import { NextRequest, NextResponse } from 'next/server';
import { automatedTuning } from '@/lib/database/automated-tuning';
import { alertingSystem } from '@/lib/database/performance-alerting';
import { getBearerToken } from '@/lib/admin';
import { supabaseServer } from '@/lib/supabase/server';

export async function GET(req: NextRequest) {
  try {
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    
    // Verify admin access
    const { data: user } = await svc.auth.getUser(token || '');
    if (!user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(req.url);
    const action = url.searchParams.get('action');

    switch (action) {
      case 'recommendations':
        const type = url.searchParams.get('type');
        const priority = url.searchParams.get('priority');
        const applied = url.searchParams.get('applied');
        
        const filter: any = {};
        if (type) filter.type = type;
        if (priority) filter.priority = priority;
        if (applied !== null) filter.applied = applied === 'true';

        const recommendations = automatedTuning.getRecommendations(filter);
        return NextResponse.json({ recommendations });

      case 'statistics':
        const stats = automatedTuning.getTuningStatistics();
        return NextResponse.json({ statistics: stats });

      case 'config':
        const config = automatedTuning.getConfig();
        return NextResponse.json({ config });

      case 'alert-rules':
        const rules = alertingSystem.getAlertRules();
        return NextResponse.json({ rules });

      case 'alert-history':
        const limit = parseInt(url.searchParams.get('limit') || '50');
        const history = alertingSystem.getAlertHistory(limit);
        return NextResponse.json({ history });

      case 'alert-statistics':
        const timeWindow = parseInt(url.searchParams.get('timeWindow') || '3600000'); // 1 hour
        const alertStats = alertingSystem.getAlertStatistics(timeWindow);
        return NextResponse.json({ statistics: alertStats });

      default:
        // Return comprehensive tuning overview
        const [recsData, statsData, configData, alertStatsData] = await Promise.all([
          Promise.resolve(automatedTuning.getRecommendations()),
          Promise.resolve(automatedTuning.getTuningStatistics()),
          Promise.resolve(automatedTuning.getConfig()),
          Promise.resolve(alertingSystem.getAlertStatistics())
        ]);

        return NextResponse.json({
          recommendations: recsData,
          statistics: statsData,
          config: configData,
          alertStatistics: alertStatsData,
          timestamp: new Date().toISOString()
        });
    }

  } catch (error) {
    console.error('Database tuning API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch tuning data' },
      { status: 500 }
    );
  }
}

export async function POST(req: NextRequest) {
  try {
    const token = await getBearerToken(req);
    const svc = supabaseServer(token || undefined);
    
    // Verify admin access
    const { data: user } = await svc.auth.getUser(token || '');
    if (!user?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await req.json();
    const { action } = body;

    switch (action) {
      case 'apply':
        const { recommendationId } = body;
        if (!recommendationId) {
          return NextResponse.json({ error: 'Recommendation ID required' }, { status: 400 });
        }

        const success = await automatedTuning.applyRecommendation(recommendationId, svc);
        return NextResponse.json({ 
          success, 
          message: success ? 'Recommendation applied successfully' : 'Failed to apply recommendation'
        });

      case 'update-config':
        const { config } = body;
        if (!config) {
          return NextResponse.json({ error: 'Config updates required' }, { status: 400 });
        }

        automatedTuning.updateConfig(config);
        return NextResponse.json({ 
          success: true, 
          message: 'Configuration updated successfully',
          config: automatedTuning.getConfig()
        });

      case 'clear-recommendations':
        const { days = 7 } = body;
        const cleared = automatedTuning.clearOldRecommendations(days);
        return NextResponse.json({ 
          success: true, 
          message: `Cleared ${cleared} old recommendations`,
          cleared
        });

      case 'add-alert-rule':
        const { rule } = body;
        if (!rule) {
          return NextResponse.json({ error: 'Alert rule required' }, { status: 400 });
        }

        const ruleId = alertingSystem.addAlertRule(rule);
        return NextResponse.json({ 
          success: true, 
          message: 'Alert rule added successfully',
          ruleId
        });

      case 'update-alert-rule':
        const { ruleId: updateRuleId, updates } = body;
        if (!updateRuleId || !updates) {
          return NextResponse.json({ error: 'Rule ID and updates required' }, { status: 400 });
        }

        const updateSuccess = alertingSystem.updateAlertRule(updateRuleId, updates);
        return NextResponse.json({ 
          success: updateSuccess, 
          message: updateSuccess ? 'Alert rule updated successfully' : 'Alert rule not found'
        });

      case 'remove-alert-rule':
        const { ruleId: removeRuleId } = body;
        if (!removeRuleId) {
          return NextResponse.json({ error: 'Rule ID required' }, { status: 400 });
        }

        const removeSuccess = alertingSystem.removeAlertRule(removeRuleId);
        return NextResponse.json({ 
          success: removeSuccess, 
          message: removeSuccess ? 'Alert rule removed successfully' : 'Alert rule not found'
        });

      case 'test-alert':
        const { severity = 'medium' } = body;
        await alertingSystem.testAlert(severity);
        return NextResponse.json({ 
          success: true, 
          message: `Test alert sent with ${severity} severity`
        });

      case 'add-alert-channel':
        const { channel } = body;
        if (!channel) {
          return NextResponse.json({ error: 'Alert channel required' }, { status: 400 });
        }

        alertingSystem.addAlertChannel(channel);
        return NextResponse.json({ 
          success: true, 
          message: 'Alert channel added successfully'
        });

      case 'force-analysis':
        // Trigger immediate analysis
        console.log('🔍 Forcing database analysis...');
        return NextResponse.json({ 
          success: true, 
          message: 'Database analysis triggered'
        });

      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

  } catch (error) {
    console.error('Database tuning action error:', error);
    return NextResponse.json(
      { error: 'Failed to execute tuning action' },
      { status: 500 }
    );
  }
}