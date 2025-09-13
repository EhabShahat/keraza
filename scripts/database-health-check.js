#!/usr/bin/env node

/**
 * Database Health Check Script
 * Performs comprehensive database health monitoring and generates reports
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
  outputDir: './health-reports',
  alertThresholds: {
    responseTime: 1000, // ms
    errorRate: 0.05, // 5%
    connectionUtilization: 0.8, // 80%
    slowQueryCount: 10
  }
};

class DatabaseHealthChecker {
  constructor() {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
    this.startTime = new Date();
  }

  /**
   * Run comprehensive health check
   */
  async runHealthCheck() {
    console.log('🏥 Starting database health check...');
    
    const report = {
      timestamp: this.startTime.toISOString(),
      summary: {},
      details: {},
      recommendations: [],
      alerts: []
    };

    try {
      // Basic connectivity test
      report.details.connectivity = await this.checkConnectivity();
      
      // Performance metrics
      report.details.performance = await this.checkPerformance();
      
      // Table statistics
      report.details.tables = await this.checkTableStats();
      
      // Index usage
      report.details.indexes = await this.checkIndexUsage();
      
      // Connection statistics
      report.details.connections = await this.checkConnections();
      
      // Generate summary and recommendations
      report.summary = this.generateSummary(report.details);
      report.recommendations = this.generateRecommendations(report.details);
      report.alerts = this.generateAlerts(report.details);
      
      // Save report
      await this.saveReport(report);
      
      // Display results
      this.displayResults(report);
      
      return report;
      
    } catch (error) {
      console.error('❌ Health check failed:', error);
      report.error = error.message;
      return report;
    }
  }

  /**
   * Check basic database connectivity
   */
  async checkConnectivity() {
    const start = Date.now();
    
    try {
      const { data, error } = await this.supabase
        .from('app_config')
        .select('id')
        .limit(1);
      
      const responseTime = Date.now() - start;
      
      return {
        status: error ? 'failed' : 'success',
        responseTime,
        error: error?.message
      };
    } catch (error) {
      return {
        status: 'failed',
        responseTime: Date.now() - start,
        error: error.message
      };
    }
  }

  /**
   * Check database performance metrics
   */
  async checkPerformance() {
    try {
      // Simulate multiple queries to test performance
      const queries = [
        () => this.supabase.from('exams').select('id').limit(10),
        () => this.supabase.from('students').select('id').limit(10),
        () => this.supabase.from('exam_attempts').select('id').limit(10),
        () => this.supabase.from('app_config').select('*').limit(5)
      ];

      const results = [];
      let totalTime = 0;
      let errors = 0;

      for (const query of queries) {
        const start = Date.now();
        try {
          const { error } = await query();
          const duration = Date.now() - start;
          totalTime += duration;
          
          if (error) errors++;
          
          results.push({
            duration,
            success: !error,
            error: error?.message
          });
        } catch (error) {
          const duration = Date.now() - start;
          totalTime += duration;
          errors++;
          
          results.push({
            duration,
            success: false,
            error: error.message
          });
        }
      }

      return {
        averageResponseTime: totalTime / queries.length,
        totalQueries: queries.length,
        errorRate: errors / queries.length,
        results
      };
    } catch (error) {
      return {
        error: error.message,
        averageResponseTime: 0,
        totalQueries: 0,
        errorRate: 1
      };
    }
  }

  /**
   * Check table statistics
   */
  async checkTableStats() {
    try {
      const { data, error } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            n_tup_ins as inserts,
            n_tup_upd as updates,
            n_tup_del as deletes,
            n_live_tup as live_tuples,
            n_dead_tup as dead_tuples,
            last_vacuum,
            last_autovacuum,
            last_analyze,
            last_autoanalyze
          FROM pg_stat_user_tables 
          WHERE schemaname = 'public'
          ORDER BY n_live_tup DESC;
        `
      });

      if (error) throw error;

      return {
        tables: data || [],
        totalTables: data?.length || 0,
        needsVacuum: data?.filter(t => 
          t.dead_tuples > 0 && (!t.last_vacuum && !t.last_autovacuum)
        ).length || 0
      };
    } catch (error) {
      return {
        error: error.message,
        tables: [],
        totalTables: 0
      };
    }
  }

  /**
   * Check index usage statistics
   */
  async checkIndexUsage() {
    try {
      const { data, error } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            schemaname,
            tablename,
            indexname,
            idx_tup_read,
            idx_tup_fetch,
            idx_scan
          FROM pg_stat_user_indexes 
          WHERE schemaname = 'public'
          ORDER BY idx_tup_read DESC;
        `
      });

      if (error) throw error;

      const indexes = data || [];
      const unusedIndexes = indexes.filter(idx => idx.idx_scan === 0);

      return {
        indexes,
        totalIndexes: indexes.length,
        unusedIndexes: unusedIndexes.length,
        unusedIndexList: unusedIndexes.map(idx => idx.indexname)
      };
    } catch (error) {
      return {
        error: error.message,
        indexes: [],
        totalIndexes: 0,
        unusedIndexes: 0
      };
    }
  }

  /**
   * Check connection statistics
   */
  async checkConnections() {
    try {
      const { data, error } = await this.supabase.rpc('exec_sql', {
        sql: `
          SELECT 
            count(*) as total_connections,
            count(*) FILTER (WHERE state = 'active') as active_connections,
            count(*) FILTER (WHERE state = 'idle') as idle_connections,
            count(*) FILTER (WHERE state = 'idle in transaction') as idle_in_transaction
          FROM pg_stat_activity 
          WHERE datname = current_database();
        `
      });

      if (error) throw error;

      const stats = data?.[0] || {};
      
      return {
        total: parseInt(stats.total_connections) || 0,
        active: parseInt(stats.active_connections) || 0,
        idle: parseInt(stats.idle_connections) || 0,
        idleInTransaction: parseInt(stats.idle_in_transaction) || 0,
        utilization: stats.total_connections ? stats.active_connections / stats.total_connections : 0
      };
    } catch (error) {
      return {
        error: error.message,
        total: 0,
        active: 0,
        idle: 0,
        utilization: 0
      };
    }
  }

  /**
   * Generate health summary
   */
  generateSummary(details) {
    const summary = {
      overallHealth: 'healthy',
      issues: [],
      metrics: {}
    };

    // Check connectivity
    if (details.connectivity?.status !== 'success') {
      summary.overallHealth = 'critical';
      summary.issues.push('Database connectivity failed');
    }

    // Check performance
    if (details.performance?.averageResponseTime > config.alertThresholds.responseTime) {
      summary.overallHealth = summary.overallHealth === 'healthy' ? 'degraded' : summary.overallHealth;
      summary.issues.push(`High response time: ${details.performance.averageResponseTime}ms`);
    }

    if (details.performance?.errorRate > config.alertThresholds.errorRate) {
      summary.overallHealth = 'critical';
      summary.issues.push(`High error rate: ${(details.performance.errorRate * 100).toFixed(1)}%`);
    }

    // Check connections
    if (details.connections?.utilization > config.alertThresholds.connectionUtilization) {
      summary.overallHealth = summary.overallHealth === 'healthy' ? 'degraded' : summary.overallHealth;
      summary.issues.push(`High connection utilization: ${(details.connections.utilization * 100).toFixed(1)}%`);
    }

    // Set metrics
    summary.metrics = {
      responseTime: details.performance?.averageResponseTime || 0,
      errorRate: details.performance?.errorRate || 0,
      connectionUtilization: details.connections?.utilization || 0,
      totalTables: details.tables?.totalTables || 0,
      totalIndexes: details.indexes?.totalIndexes || 0
    };

    return summary;
  }

  /**
   * Generate recommendations
   */
  generateRecommendations(details) {
    const recommendations = [];

    // Performance recommendations
    if (details.performance?.averageResponseTime > 500) {
      recommendations.push({
        type: 'performance',
        priority: 'medium',
        title: 'Optimize slow queries',
        description: 'Average response time is above optimal threshold'
      });
    }

    // Index recommendations
    if (details.indexes?.unusedIndexes > 0) {
      recommendations.push({
        type: 'index',
        priority: 'low',
        title: 'Remove unused indexes',
        description: `${details.indexes.unusedIndexes} unused indexes found`,
        details: details.indexes.unusedIndexList
      });
    }

    // Vacuum recommendations
    if (details.tables?.needsVacuum > 0) {
      recommendations.push({
        type: 'maintenance',
        priority: 'medium',
        title: 'Run VACUUM on tables with dead tuples',
        description: `${details.tables.needsVacuum} tables need vacuuming`
      });
    }

    // Connection recommendations
    if (details.connections?.utilization > 0.7) {
      recommendations.push({
        type: 'connection',
        priority: 'medium',
        title: 'Monitor connection pool usage',
        description: 'Connection utilization is approaching limits'
      });
    }

    return recommendations;
  }

  /**
   * Generate alerts
   */
  generateAlerts(details) {
    const alerts = [];

    // Critical alerts
    if (details.connectivity?.status !== 'success') {
      alerts.push({
        severity: 'critical',
        message: 'Database connectivity failed',
        details: details.connectivity
      });
    }

    if (details.performance?.errorRate > config.alertThresholds.errorRate) {
      alerts.push({
        severity: 'critical',
        message: `High error rate: ${(details.performance.errorRate * 100).toFixed(1)}%`,
        threshold: config.alertThresholds.errorRate
      });
    }

    // Warning alerts
    if (details.performance?.averageResponseTime > config.alertThresholds.responseTime) {
      alerts.push({
        severity: 'warning',
        message: `High response time: ${details.performance.averageResponseTime}ms`,
        threshold: config.alertThresholds.responseTime
      });
    }

    if (details.connections?.utilization > config.alertThresholds.connectionUtilization) {
      alerts.push({
        severity: 'warning',
        message: `High connection utilization: ${(details.connections.utilization * 100).toFixed(1)}%`,
        threshold: config.alertThresholds.connectionUtilization
      });
    }

    return alerts;
  }

  /**
   * Save health report to file
   */
  async saveReport(report) {
    try {
      // Ensure output directory exists
      await fs.mkdir(config.outputDir, { recursive: true });
      
      const filename = `health-report-${this.startTime.toISOString().replace(/[:.]/g, '-')}.json`;
      const filepath = path.join(config.outputDir, filename);
      
      await fs.writeFile(filepath, JSON.stringify(report, null, 2));
      
      console.log(`📄 Report saved to: ${filepath}`);
      
      // Also save latest report
      const latestPath = path.join(config.outputDir, 'latest-health-report.json');
      await fs.writeFile(latestPath, JSON.stringify(report, null, 2));
      
    } catch (error) {
      console.error('Failed to save report:', error);
    }
  }

  /**
   * Display results in console
   */
  displayResults(report) {
    console.log('\n' + '='.repeat(60));
    console.log('📊 DATABASE HEALTH CHECK RESULTS');
    console.log('='.repeat(60));
    
    // Overall health
    const healthEmoji = {
      healthy: '✅',
      degraded: '⚠️',
      critical: '🚨'
    };
    
    console.log(`\n🏥 Overall Health: ${healthEmoji[report.summary.overallHealth]} ${report.summary.overallHealth.toUpperCase()}`);
    
    // Issues
    if (report.summary.issues.length > 0) {
      console.log('\n🚨 Issues Found:');
      report.summary.issues.forEach(issue => {
        console.log(`   • ${issue}`);
      });
    }
    
    // Key metrics
    console.log('\n📈 Key Metrics:');
    console.log(`   • Response Time: ${report.summary.metrics.responseTime}ms`);
    console.log(`   • Error Rate: ${(report.summary.metrics.errorRate * 100).toFixed(2)}%`);
    console.log(`   • Connection Utilization: ${(report.summary.metrics.connectionUtilization * 100).toFixed(1)}%`);
    console.log(`   • Tables: ${report.summary.metrics.totalTables}`);
    console.log(`   • Indexes: ${report.summary.metrics.totalIndexes}`);
    
    // Recommendations
    if (report.recommendations.length > 0) {
      console.log('\n💡 Recommendations:');
      report.recommendations.forEach(rec => {
        const priorityEmoji = { critical: '🚨', high: '⚠️', medium: '⚡', low: 'ℹ️' };
        console.log(`   ${priorityEmoji[rec.priority]} ${rec.title}`);
        console.log(`      ${rec.description}`);
      });
    }
    
    // Alerts
    if (report.alerts.length > 0) {
      console.log('\n🔔 Active Alerts:');
      report.alerts.forEach(alert => {
        const severityEmoji = { critical: '🚨', warning: '⚠️', info: 'ℹ️' };
        console.log(`   ${severityEmoji[alert.severity]} ${alert.message}`);
      });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log(`✅ Health check completed in ${Date.now() - this.startTime.getTime()}ms`);
    console.log('='.repeat(60) + '\n');
  }
}

// Main execution
async function main() {
  try {
    const checker = new DatabaseHealthChecker();
    const report = await checker.runHealthCheck();
    
    // Exit with appropriate code
    const exitCode = report.summary?.overallHealth === 'critical' ? 1 : 0;
    process.exit(exitCode);
    
  } catch (error) {
    console.error('❌ Health check script failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { DatabaseHealthChecker };