#!/usr/bin/env node

/**
 * Auto-Recovery Initialization Script
 * Sets up automated recovery and scaling for all consolidated functions
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables from .env.local
const envPath = path.join(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) {
      process.env[key.trim()] = value.trim();
    }
  });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Default configurations for auto-recovery
const defaultConfigs = {
  admin: {
    recovery: {
      enabled: true,
      failover_threshold: 10, // 10% error rate
      recovery_timeout: 30000, // 30 seconds
      max_retries: 3,
      circuit_breaker: {
        failure_threshold: 5,
        recovery_timeout: 60000, // 1 minute
        half_open_max_calls: 3
      }
    },
    load_balancing: {
      strategy: 'health_based',
      health_check_interval: 30000,
      unhealthy_threshold: 3,
      sticky_sessions: true
    },
    scaling: {
      enabled: true,
      min_instances: 1,
      max_instances: 3,
      scale_up_threshold: {
        cpu_percent: 70,
        memory_percent: 80,
        response_time_ms: 3000,
        error_rate_percent: 5
      },
      scale_down_threshold: {
        cpu_percent: 30,
        memory_percent: 40,
        response_time_ms: 1000,
        idle_time_minutes: 10
      },
      cooldown_period: 300000 // 5 minutes
    }
  },
  public: {
    recovery: {
      enabled: true,
      failover_threshold: 5, // 5% error rate
      recovery_timeout: 15000, // 15 seconds
      max_retries: 5,
      circuit_breaker: {
        failure_threshold: 3,
        recovery_timeout: 30000, // 30 seconds
        half_open_max_calls: 5
      }
    },
    load_balancing: {
      strategy: 'response_time',
      health_check_interval: 15000,
      unhealthy_threshold: 2,
      sticky_sessions: false
    },
    scaling: {
      enabled: true,
      min_instances: 2,
      max_instances: 5,
      scale_up_threshold: {
        cpu_percent: 60,
        memory_percent: 70,
        response_time_ms: 2000,
        error_rate_percent: 3
      },
      scale_down_threshold: {
        cpu_percent: 25,
        memory_percent: 35,
        response_time_ms: 800,
        idle_time_minutes: 15
      },
      cooldown_period: 180000 // 3 minutes
    }
  },
  attempts: {
    recovery: {
      enabled: true,
      failover_threshold: 8, // 8% error rate
      recovery_timeout: 20000, // 20 seconds
      max_retries: 3,
      circuit_breaker: {
        failure_threshold: 4,
        recovery_timeout: 45000, // 45 seconds
        half_open_max_calls: 2
      }
    },
    load_balancing: {
      strategy: 'least_connections',
      health_check_interval: 10000,
      unhealthy_threshold: 2,
      sticky_sessions: true
    },
    scaling: {
      enabled: true,
      min_instances: 1,
      max_instances: 4,
      scale_up_threshold: {
        cpu_percent: 75,
        memory_percent: 85,
        response_time_ms: 4000,
        error_rate_percent: 8
      },
      scale_down_threshold: {
        cpu_percent: 35,
        memory_percent: 45,
        response_time_ms: 1500,
        idle_time_minutes: 8
      },
      cooldown_period: 240000 // 4 minutes
    }
  }
};

async function createAutoRecoveryTables() {
  console.log('Creating auto-recovery tables...');

  // Create function_instances table
  const { error: instancesError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS function_instances (
        id TEXT PRIMARY KEY,
        function_name TEXT NOT NULL,
        endpoint TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('active', 'inactive', 'recovering', 'failed')),
        health JSONB NOT NULL DEFAULT '{}',
        connections INTEGER NOT NULL DEFAULT 0,
        last_request TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_function_instances_function_name ON function_instances(function_name);
      CREATE INDEX IF NOT EXISTS idx_function_instances_status ON function_instances(status);
      CREATE INDEX IF NOT EXISTS idx_function_instances_created_at ON function_instances(created_at);
    `
  });

  if (instancesError) {
    console.error('Error creating function_instances table:', instancesError);
    return false;
  }

  // Create circuit_breaker_states table
  const { error: circuitError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS circuit_breaker_states (
        function_name TEXT PRIMARY KEY,
        state TEXT NOT NULL CHECK (state IN ('closed', 'open', 'half_open')),
        failure_count INTEGER NOT NULL DEFAULT 0,
        last_failure TIMESTAMPTZ,
        next_attempt TIMESTAMPTZ,
        half_open_calls INTEGER NOT NULL DEFAULT 0,
        config JSONB NOT NULL DEFAULT '{}',
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_circuit_breaker_states_state ON circuit_breaker_states(state);
      CREATE INDEX IF NOT EXISTS idx_circuit_breaker_states_updated_at ON circuit_breaker_states(updated_at);
    `
  });

  if (circuitError) {
    console.error('Error creating circuit_breaker_states table:', circuitError);
    return false;
  }

  // Create auto_recovery_configs table
  const { error: configError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS auto_recovery_configs (
        function_name TEXT PRIMARY KEY,
        recovery_config JSONB NOT NULL DEFAULT '{}',
        load_balancing_config JSONB NOT NULL DEFAULT '{}',
        scaling_config JSONB NOT NULL DEFAULT '{}',
        enabled BOOLEAN NOT NULL DEFAULT true,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_auto_recovery_configs_enabled ON auto_recovery_configs(enabled);
      CREATE INDEX IF NOT EXISTS idx_auto_recovery_configs_updated_at ON auto_recovery_configs(updated_at);
    `
  });

  if (configError) {
    console.error('Error creating auto_recovery_configs table:', configError);
    return false;
  }

  // Create scaling_actions table for tracking scaling history
  const { error: scalingError } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS scaling_actions (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        function_name TEXT NOT NULL,
        action TEXT NOT NULL CHECK (action IN ('scale_up', 'scale_down', 'failover', 'recovery')),
        instance_count_before INTEGER NOT NULL,
        instance_count_after INTEGER NOT NULL,
        trigger_reason TEXT,
        metrics JSONB DEFAULT '{}',
        success BOOLEAN NOT NULL DEFAULT true,
        error_message TEXT,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_scaling_actions_function_name ON scaling_actions(function_name);
      CREATE INDEX IF NOT EXISTS idx_scaling_actions_action ON scaling_actions(action);
      CREATE INDEX IF NOT EXISTS idx_scaling_actions_created_at ON scaling_actions(created_at);
    `
  });

  if (scalingError) {
    console.error('Error creating scaling_actions table:', scalingError);
    return false;
  }

  console.log('✅ Auto-recovery tables created successfully');
  return true;
}

async function insertDefaultConfigs() {
  console.log('Inserting default auto-recovery configurations...');

  for (const [functionName, config] of Object.entries(defaultConfigs)) {
    const { error } = await supabase
      .from('auto_recovery_configs')
      .upsert({
        function_name: functionName,
        recovery_config: config.recovery,
        load_balancing_config: config.load_balancing,
        scaling_config: config.scaling,
        enabled: true,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`Error inserting config for ${functionName}:`, error);
      return false;
    }

    console.log(`✅ Configuration inserted for ${functionName}`);
  }

  return true;
}

async function initializeCircuitBreakers() {
  console.log('Initializing circuit breakers...');

  for (const functionName of Object.keys(defaultConfigs)) {
    const { error } = await supabase
      .from('circuit_breaker_states')
      .upsert({
        function_name: functionName,
        state: 'closed',
        failure_count: 0,
        half_open_calls: 0,
        config: defaultConfigs[functionName].recovery.circuit_breaker,
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error(`Error initializing circuit breaker for ${functionName}:`, error);
      return false;
    }

    console.log(`✅ Circuit breaker initialized for ${functionName}`);
  }

  return true;
}

async function createAutoRecoveryRPCs() {
  console.log('Creating auto-recovery RPC functions...');

  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      -- Function to update circuit breaker state
      CREATE OR REPLACE FUNCTION update_circuit_breaker_state(
        p_function_name TEXT,
        p_state TEXT,
        p_failure_count INTEGER DEFAULT NULL,
        p_half_open_calls INTEGER DEFAULT NULL
      )
      RETURNS VOID AS $$
      BEGIN
        UPDATE circuit_breaker_states
        SET 
          state = p_state,
          failure_count = COALESCE(p_failure_count, failure_count),
          half_open_calls = COALESCE(p_half_open_calls, half_open_calls),
          last_failure = CASE WHEN p_state = 'open' THEN NOW() ELSE last_failure END,
          next_attempt = CASE WHEN p_state = 'open' THEN NOW() + INTERVAL '1 minute' ELSE next_attempt END,
          updated_at = NOW()
        WHERE function_name = p_function_name;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to record scaling action
      CREATE OR REPLACE FUNCTION record_scaling_action(
        p_function_name TEXT,
        p_action TEXT,
        p_instance_count_before INTEGER,
        p_instance_count_after INTEGER,
        p_trigger_reason TEXT DEFAULT NULL,
        p_metrics JSONB DEFAULT '{}',
        p_success BOOLEAN DEFAULT true,
        p_error_message TEXT DEFAULT NULL
      )
      RETURNS UUID AS $$
      DECLARE
        action_id UUID;
      BEGIN
        INSERT INTO scaling_actions (
          function_name,
          action,
          instance_count_before,
          instance_count_after,
          trigger_reason,
          metrics,
          success,
          error_message
        ) VALUES (
          p_function_name,
          p_action,
          p_instance_count_before,
          p_instance_count_after,
          p_trigger_reason,
          p_metrics,
          p_success,
          p_error_message
        ) RETURNING id INTO action_id;
        
        RETURN action_id;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to get function health summary
      CREATE OR REPLACE FUNCTION get_function_health_summary(p_function_name TEXT DEFAULT NULL)
      RETURNS TABLE (
        function_name TEXT,
        total_instances INTEGER,
        active_instances INTEGER,
        healthy_instances INTEGER,
        circuit_breaker_state TEXT,
        last_scaling_action TIMESTAMPTZ,
        avg_response_time NUMERIC,
        error_rate NUMERIC
      ) AS $$
      BEGIN
        RETURN QUERY
        SELECT 
          COALESCE(fi.function_name, cb.function_name) as function_name,
          COUNT(fi.id)::INTEGER as total_instances,
          COUNT(CASE WHEN fi.status = 'active' THEN 1 END)::INTEGER as active_instances,
          COUNT(CASE WHEN fi.health->>'status' = 'healthy' THEN 1 END)::INTEGER as healthy_instances,
          cb.state as circuit_breaker_state,
          sa.last_action as last_scaling_action,
          AVG((fi.health->>'response_time')::NUMERIC) as avg_response_time,
          AVG((fi.health->>'error_rate')::NUMERIC) as error_rate
        FROM circuit_breaker_states cb
        LEFT JOIN function_instances fi ON cb.function_name = fi.function_name
        LEFT JOIN (
          SELECT 
            function_name,
            MAX(created_at) as last_action
          FROM scaling_actions
          GROUP BY function_name
        ) sa ON cb.function_name = sa.function_name
        WHERE (p_function_name IS NULL OR cb.function_name = p_function_name)
        GROUP BY cb.function_name, cb.state, sa.last_action;
      END;
      $$ LANGUAGE plpgsql;

      -- Function to cleanup old scaling actions (keep last 1000 per function)
      CREATE OR REPLACE FUNCTION cleanup_scaling_actions()
      RETURNS INTEGER AS $$
      DECLARE
        deleted_count INTEGER := 0;
      BEGIN
        WITH ranked_actions AS (
          SELECT id, ROW_NUMBER() OVER (PARTITION BY function_name ORDER BY created_at DESC) as rn
          FROM scaling_actions
        )
        DELETE FROM scaling_actions
        WHERE id IN (
          SELECT id FROM ranked_actions WHERE rn > 1000
        );
        
        GET DIAGNOSTICS deleted_count = ROW_COUNT;
        RETURN deleted_count;
      END;
      $$ LANGUAGE plpgsql;
    `
  });

  if (error) {
    console.error('Error creating auto-recovery RPC functions:', error);
    return false;
  }

  console.log('✅ Auto-recovery RPC functions created successfully');
  return true;
}

async function validateSetup() {
  console.log('Validating auto-recovery setup...');

  // Check if all tables exist
  const tables = ['function_instances', 'circuit_breaker_states', 'auto_recovery_configs', 'scaling_actions'];
  
  for (const table of tables) {
    const { data, error } = await supabase
      .from(table)
      .select('*')
      .limit(1);

    if (error) {
      console.error(`❌ Table ${table} validation failed:`, error);
      return false;
    }
  }

  // Check if configurations exist
  const { data: configs, error: configError } = await supabase
    .from('auto_recovery_configs')
    .select('function_name')
    .in('function_name', Object.keys(defaultConfigs));

  if (configError) {
    console.error('❌ Configuration validation failed:', configError);
    return false;
  }

  if (configs.length !== Object.keys(defaultConfigs).length) {
    console.error('❌ Missing configurations for some functions');
    return false;
  }

  // Check if circuit breakers exist
  const { data: circuitBreakers, error: circuitError } = await supabase
    .from('circuit_breaker_states')
    .select('function_name')
    .in('function_name', Object.keys(defaultConfigs));

  if (circuitError) {
    console.error('❌ Circuit breaker validation failed:', circuitError);
    return false;
  }

  if (circuitBreakers.length !== Object.keys(defaultConfigs).length) {
    console.error('❌ Missing circuit breakers for some functions');
    return false;
  }

  console.log('✅ Auto-recovery setup validation passed');
  return true;
}

async function main() {
  console.log('🚀 Initializing Auto-Recovery System...\n');

  try {
    // Create tables
    if (!(await createAutoRecoveryTables())) {
      throw new Error('Failed to create auto-recovery tables');
    }

    // Create RPC functions
    if (!(await createAutoRecoveryRPCs())) {
      throw new Error('Failed to create auto-recovery RPC functions');
    }

    // Insert default configurations
    if (!(await insertDefaultConfigs())) {
      throw new Error('Failed to insert default configurations');
    }

    // Initialize circuit breakers
    if (!(await initializeCircuitBreakers())) {
      throw new Error('Failed to initialize circuit breakers');
    }

    // Validate setup
    if (!(await validateSetup())) {
      throw new Error('Setup validation failed');
    }

    console.log('\n🎉 Auto-Recovery System initialized successfully!');
    console.log('\nNext steps:');
    console.log('1. Start the application: npm run dev');
    console.log('2. Visit /admin/monitoring to view the auto-recovery dashboard');
    console.log('3. Initialize auto-recovery for each function via the dashboard or API');

  } catch (error) {
    console.error('\n❌ Auto-recovery initialization failed:', error.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  createAutoRecoveryTables,
  insertDefaultConfigs,
  initializeCircuitBreakers,
  createAutoRecoveryRPCs,
  validateSetup
};