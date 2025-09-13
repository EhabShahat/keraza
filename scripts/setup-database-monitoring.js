#!/usr/bin/env node

/**
 * Database Monitoring Setup Script
 * Sets up comprehensive database performance monitoring infrastructure
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

// Configuration
const config = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY
};

class DatabaseMonitoringSetup {
  constructor() {
    if (!config.supabaseUrl || !config.supabaseKey) {
      throw new Error('Missing Supabase configuration');
    }

    this.supabase = createClient(config.supabaseUrl, config.supabaseKey);
  }

  /**
   * Setup complete monitoring infrastructure
   */
  async setup() {
    console.log('🔧 Setting up database performance monitoring...');

    try {
      // Create monitoring tables
      await this.createMonitoringTables();
      
      // Setup monitoring functions
      await this.createMonitoringFunctions();
      
      // Create performance indexes
      await this.createPerformanceIndexes();
      
      // Setup monitoring views
      await this.createMonitoringViews();
      
      // Initialize monitoring data
      await this.initializeMonitoringData();
      
      console.log('✅ Database monitoring setup completed successfully!');
      
    } catch (error) {
      console.error('❌ Setup failed:', error);
      throw error;
    }
  }

  /**
   * Create monitoring tables
   */
  async createMonitoringTables() {
    console.log('📊 Creating monitoring tables...');

    const monitoringSchema = `
      -- Performance metrics table
      CREATE TABLE IF NOT EXISTS performance_metrics (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        metric_type VARCHAR(50) NOT NULL,
        metric_name VARCHAR(100) NOT NULL,
        metric_value NUMERIC NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Query performance log
      CREATE TABLE IF NOT EXISTS query_performance_log (
        id BIGSERIAL PRIMARY KEY,
        query_hash VARCHAR(64) NOT NULL,
        query_pattern TEXT NOT NULL,
        execution_time_ms INTEGER NOT NULL,
        row_count INTEGER,
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        user_id UUID,
        session_id VARCHAR(100)
      );

      -- Database alerts table
      CREATE TABLE IF NOT EXISTS database_alerts (
        id BIGSERIAL PRIMARY KEY,
        alert_type VARCHAR(50) NOT NULL,
        severity VARCHAR(20) NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
        title VARCHAR(200) NOT NULL,
        message TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        resolved BOOLEAN DEFAULT false,
        resolved_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Tuning recommendations table
      CREATE TABLE IF NOT EXISTS tuning_recommendations (
        id BIGSERIAL PRIMARY KEY,
        recommendation_type VARCHAR(50) NOT NULL,
        priority VARCHAR(20) NOT NULL CHECK (priority IN ('low', 'medium', 'high', 'critical')),
        title VARCHAR(200) NOT NULL,
        description TEXT NOT NULL,
        impact_description TEXT,
        effort_level VARCHAR(20) CHECK (effort_level IN ('low', 'medium', 'high')),
        sql_suggestion TEXT,
        automated BOOLEAN DEFAULT false,
        applied BOOLEAN DEFAULT false,
        applied_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );

      -- Connection pool metrics
      CREATE TABLE IF NOT EXISTS connection_pool_metrics (
        id BIGSERIAL PRIMARY KEY,
        timestamp TIMESTAMPTZ DEFAULT NOW(),
        active_connections INTEGER NOT NULL,
        idle_connections INTEGER NOT NULL,
        total_connections INTEGER NOT NULL,
        max_connections INTEGER NOT NULL,
        utilization_percent NUMERIC(5,2) NOT NULL,
        wait_count INTEGER DEFAULT 0,
        wait_time_ms INTEGER DEFAULT 0
      );
    `;

    const { error } = await this.supabase.rpc('exec_sql', { sql: monitoringSchema });
    if (error) throw error;

    console.log('✅ Monitoring tables created');
  }

  /**
   * Create monitoring functions
   */
  async createMonitoringFunctions() {
    console.log('⚙️ Creating monitoring functions...');

    const monitoringFunctions = `
      -- Function to log query performance
      CREATE OR REPLACE FUNCTION log_query_performance(
        p_query_hash VARCHAR(64),
        p_query_pattern TEXT,
        p_execution_time_ms INTEGER,
        p_row_count INTEGER DEFAULT NULL,
        p_success BOOLEAN DEFAULT true,
        p_error_message TEXT DEFAULT NULL,
        p_user_id UUID DEFAULT NULL,
        p_session_id VARCHAR(100) DEFAULT NULL
      ) RETURNS VOID AS $$
      BEGIN
        INSERT INTO query_performance_log (
          query_hash, query_pattern, execution_time_ms, row_count,
          success, error_message, user_id, session_id
        ) VALUES (
          p_query_hash, p_query_pattern, p_execution_time_ms, p_row_count,
          p_success, p_error_message, p_user_id, p_session_id
        );
      END;
      $$ LANGUAGE plpgsql;

      -- Function to record performance metrics
      CREATE OR REPLACE FUNCTION record_performance_metric(
        p_metric_type VARCHAR(50),
        p_metric_name VARCHAR(100),
        p_metric_value NUMERIC,
        p_metadata JSONB DEFAULT '{}'
      ) RETURNS VOID AS $$
      BEGIN
        INSERT INTO performance_metrics (metric_type, metric_name, metric_value, metadata)
        VALUES (p_metric_type, p_metric_name, p_metric_value, p_metadata);
      END;
      $$ LANGUAGE plpgsql;

      -- Function to create database alert
      CREATE OR REPLACE FUNCTION create_database_alert(
        p_alert_type VARCHAR(50),
        p_severity VARCHAR(20),
        p_title VARCHAR(200),
        p_message TEXT,
        p_metadata JSONB DEFAULT '{}'
      ) RETURNS BIGINT AS $$
      DECLARE
        alert_id BIGINT;
      BEGIN
        INSERT INTO database_alerts (alert_type, severity, title, message, metadata)
        VALUES (p_alert_type, p_severity, p_title, p_message, p_metadata)
        RETURNING id INTO alert_id;
        
        RETURN alert_id;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to get database health summary
      CREATE OR REPLACE FUNCTION get_database_health_summary(
        p_time_window_minutes INTEGER DEFAULT 60
      ) RETURNS TABLE (
        total_queries BIGINT,
        avg_response_time NUMERIC,
        error_rate NUMERIC,
        slow_query_count BIGINT,
        active_alerts BIGINT,
        connection_utilization NUMERIC
      ) AS $$
      DECLARE
        time_cutoff TIMESTAMPTZ;
      BEGIN
        time_cutoff := NOW() - (p_time_window_minutes || ' minutes')::INTERVAL;
        
        RETURN QUERY
        SELECT 
          COALESCE(q.total_queries, 0) as total_queries,
          COALESCE(q.avg_response_time, 0) as avg_response_time,
          COALESCE(q.error_rate, 0) as error_rate,
          COALESCE(q.slow_query_count, 0) as slow_query_count,
          COALESCE(a.active_alerts, 0) as active_alerts,
          COALESCE(c.connection_utilization, 0) as connection_utilization
        FROM (
          SELECT 
            COUNT(*) as total_queries,
            AVG(execution_time_ms) as avg_response_time,
            (COUNT(*) FILTER (WHERE NOT success))::NUMERIC / GREATEST(COUNT(*), 1) as error_rate,
            COUNT(*) FILTER (WHERE execution_time_ms > 1000) as slow_query_count
          FROM query_performance_log 
          WHERE timestamp >= time_cutoff
        ) q
        CROSS JOIN (
          SELECT COUNT(*) as active_alerts
          FROM database_alerts 
          WHERE NOT resolved AND created_at >= time_cutoff
        ) a
        CROSS JOIN (
          SELECT AVG(utilization_percent) as connection_utilization
          FROM connection_pool_metrics 
          WHERE timestamp >= time_cutoff
        ) c;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to get slow queries analysis
      CREATE OR REPLACE FUNCTION get_slow_queries_analysis(
        p_time_window_minutes INTEGER DEFAULT 60,
        p_limit INTEGER DEFAULT 10
      ) RETURNS TABLE (
        query_pattern TEXT,
        execution_count BIGINT,
        avg_execution_time NUMERIC,
        max_execution_time INTEGER,
        total_time_ms BIGINT,
        error_count BIGINT
      ) AS $$
      DECLARE
        time_cutoff TIMESTAMPTZ;
      BEGIN
        time_cutoff := NOW() - (p_time_window_minutes || ' minutes')::INTERVAL;
        
        RETURN QUERY
        SELECT 
          qpl.query_pattern,
          COUNT(*) as execution_count,
          AVG(qpl.execution_time_ms) as avg_execution_time,
          MAX(qpl.execution_time_ms) as max_execution_time,
          SUM(qpl.execution_time_ms) as total_time_ms,
          COUNT(*) FILTER (WHERE NOT qpl.success) as error_count
        FROM query_performance_log qpl
        WHERE qpl.timestamp >= time_cutoff
        GROUP BY qpl.query_pattern
        HAVING AVG(qpl.execution_time_ms) > 500 -- Only queries slower than 500ms
        ORDER BY avg_execution_time DESC
        LIMIT p_limit;
      END;
      $$ LANGUAGE plpgsql;
    `;

    const { error } = await this.supabase.rpc('exec_sql', { sql: monitoringFunctions });
    if (error) throw error;

    console.log('✅ Monitoring functions created');
  }

  /**
   * Create performance indexes
   */
  async createPerformanceIndexes() {
    console.log('🚀 Creating performance indexes...');

    const performanceIndexes = `
      -- Indexes for performance metrics
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_timestamp 
        ON performance_metrics (timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_performance_metrics_type_name 
        ON performance_metrics (metric_type, metric_name);

      -- Indexes for query performance log
      CREATE INDEX IF NOT EXISTS idx_query_performance_timestamp 
        ON query_performance_log (timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_query_performance_hash 
        ON query_performance_log (query_hash);
      CREATE INDEX IF NOT EXISTS idx_query_performance_pattern 
        ON query_performance_log (query_pattern);
      CREATE INDEX IF NOT EXISTS idx_query_performance_execution_time 
        ON query_performance_log (execution_time_ms DESC);
      CREATE INDEX IF NOT EXISTS idx_query_performance_success 
        ON query_performance_log (success, timestamp);

      -- Indexes for database alerts
      CREATE INDEX IF NOT EXISTS idx_database_alerts_timestamp 
        ON database_alerts (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_database_alerts_resolved 
        ON database_alerts (resolved, created_at);
      CREATE INDEX IF NOT EXISTS idx_database_alerts_severity 
        ON database_alerts (severity, created_at);

      -- Indexes for tuning recommendations
      CREATE INDEX IF NOT EXISTS idx_tuning_recommendations_timestamp 
        ON tuning_recommendations (created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_tuning_recommendations_applied 
        ON tuning_recommendations (applied, created_at);
      CREATE INDEX IF NOT EXISTS idx_tuning_recommendations_priority 
        ON tuning_recommendations (priority, created_at);

      -- Indexes for connection pool metrics
      CREATE INDEX IF NOT EXISTS idx_connection_pool_timestamp 
        ON connection_pool_metrics (timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_connection_pool_utilization 
        ON connection_pool_metrics (utilization_percent DESC, timestamp);
    `;

    const { error } = await this.supabase.rpc('exec_sql', { sql: performanceIndexes });
    if (error) throw error;

    console.log('✅ Performance indexes created');
  }

  /**
   * Create monitoring views
   */
  async createMonitoringViews() {
    console.log('👁️ Creating monitoring views...');

    const monitoringViews = `
      -- View for recent performance summary
      CREATE OR REPLACE VIEW recent_performance_summary AS
      SELECT 
        DATE_TRUNC('hour', timestamp) as hour,
        COUNT(*) as total_queries,
        AVG(execution_time_ms) as avg_response_time,
        MAX(execution_time_ms) as max_response_time,
        COUNT(*) FILTER (WHERE execution_time_ms > 1000) as slow_queries,
        COUNT(*) FILTER (WHERE NOT success) as failed_queries,
        (COUNT(*) FILTER (WHERE NOT success))::NUMERIC / COUNT(*) as error_rate
      FROM query_performance_log 
      WHERE timestamp >= NOW() - INTERVAL '24 hours'
      GROUP BY DATE_TRUNC('hour', timestamp)
      ORDER BY hour DESC;

      -- View for top slow queries
      CREATE OR REPLACE VIEW top_slow_queries AS
      SELECT 
        query_pattern,
        COUNT(*) as execution_count,
        AVG(execution_time_ms) as avg_execution_time,
        MAX(execution_time_ms) as max_execution_time,
        SUM(execution_time_ms) as total_time_ms,
        COUNT(*) FILTER (WHERE NOT success) as error_count,
        (COUNT(*) FILTER (WHERE NOT success))::NUMERIC / COUNT(*) as error_rate
      FROM query_performance_log 
      WHERE timestamp >= NOW() - INTERVAL '1 hour'
      GROUP BY query_pattern
      HAVING COUNT(*) >= 3 -- At least 3 executions
      ORDER BY avg_execution_time DESC
      LIMIT 20;

      -- View for active alerts summary
      CREATE OR REPLACE VIEW active_alerts_summary AS
      SELECT 
        alert_type,
        severity,
        COUNT(*) as alert_count,
        MIN(created_at) as oldest_alert,
        MAX(created_at) as newest_alert
      FROM database_alerts 
      WHERE NOT resolved
      GROUP BY alert_type, severity
      ORDER BY 
        CASE severity 
          WHEN 'critical' THEN 1 
          WHEN 'high' THEN 2 
          WHEN 'medium' THEN 3 
          WHEN 'low' THEN 4 
        END,
        alert_count DESC;

      -- View for connection pool trends
      CREATE OR REPLACE VIEW connection_pool_trends AS
      SELECT 
        DATE_TRUNC('minute', timestamp) as minute,
        AVG(active_connections) as avg_active,
        AVG(idle_connections) as avg_idle,
        AVG(total_connections) as avg_total,
        AVG(utilization_percent) as avg_utilization,
        MAX(utilization_percent) as max_utilization
      FROM connection_pool_metrics 
      WHERE timestamp >= NOW() - INTERVAL '2 hours'
      GROUP BY DATE_TRUNC('minute', timestamp)
      ORDER BY minute DESC;
    `;

    const { error } = await this.supabase.rpc('exec_sql', { sql: monitoringViews });
    if (error) throw error;

    console.log('✅ Monitoring views created');
  }

  /**
   * Initialize monitoring data
   */
  async initializeMonitoringData() {
    console.log('🌱 Initializing monitoring data...');

    // Create initial performance baseline
    const { error: metricsError } = await this.supabase.rpc('record_performance_metric', {
      p_metric_type: 'system',
      p_metric_name: 'monitoring_initialized',
      p_metric_value: 1,
      p_metadata: { 
        timestamp: new Date().toISOString(),
        version: '1.0.0'
      }
    });

    if (metricsError) throw metricsError;

    // Create initial connection pool entry
    const { error: poolError } = await this.supabase
      .from('connection_pool_metrics')
      .insert({
        active_connections: 1,
        idle_connections: 0,
        total_connections: 1,
        max_connections: 10,
        utilization_percent: 10.0
      });

    if (poolError) throw poolError;

    console.log('✅ Monitoring data initialized');
  }

  /**
   * Verify monitoring setup
   */
  async verifySetup() {
    console.log('🔍 Verifying monitoring setup...');

    try {
      // Test monitoring functions
      const { data: healthData, error: healthError } = await this.supabase
        .rpc('get_database_health_summary', { p_time_window_minutes: 60 });

      if (healthError) throw healthError;

      console.log('📊 Health summary test:', healthData);

      // Test slow queries function
      const { data: slowQueries, error: slowError } = await this.supabase
        .rpc('get_slow_queries_analysis', { p_time_window_minutes: 60, p_limit: 5 });

      if (slowError) throw slowError;

      console.log('🐌 Slow queries test:', slowQueries);

      // Test views
      const { data: viewData, error: viewError } = await this.supabase
        .from('recent_performance_summary')
        .select('*')
        .limit(1);

      if (viewError) throw viewError;

      console.log('👁️ View test:', viewData);

      console.log('✅ Monitoring setup verification completed successfully!');

    } catch (error) {
      console.error('❌ Verification failed:', error);
      throw error;
    }
  }
}

// Main execution
async function main() {
  try {
    const setup = new DatabaseMonitoringSetup();
    
    console.log('🚀 Starting database monitoring setup...\n');
    
    await setup.setup();
    await setup.verifySetup();
    
    console.log('\n🎉 Database monitoring setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run the health check script: node scripts/database-health-check.js');
    console.log('   2. Access the monitoring dashboard in the admin panel');
    console.log('   3. Configure alert thresholds as needed');
    console.log('   4. Set up automated monitoring cron jobs');
    
  } catch (error) {
    console.error('\n❌ Setup failed:', error);
    process.exit(1);
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { DatabaseMonitoringSetup };