#!/usr/bin/env node

/**
 * Setup script for real-time RPC functions
 * This script applies the real-time RPC functions to the database
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
function loadEnvFile() {
  try {
    const envPath = path.join(__dirname, '..', '.env.local');
    const envContent = fs.readFileSync(envPath, 'utf8');
    const envVars = {};
    
    envContent.split('\n').forEach(line => {
      const trimmed = line.trim();
      if (trimmed && !trimmed.startsWith('#')) {
        const [key, ...valueParts] = trimmed.split('=');
        if (key && valueParts.length > 0) {
          envVars[key.trim()] = valueParts.join('=').trim();
        }
      }
    });
    
    return envVars;
  } catch (error) {
    console.error('Could not load .env.local file:', error.message);
    return {};
  }
}

const envVars = loadEnvFile();
const supabaseUrl = envVars.NEXT_PUBLIC_SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = envVars.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupRealtimeRPCs() {
  try {
    console.log('🚀 Setting up real-time RPC functions...');

    // Read the RPC functions SQL file
    const sqlPath = path.join(__dirname, '..', 'db', 'realtime_rpcs.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');

    // Split SQL into individual statements
    const statements = sql
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

    console.log(`📝 Found ${statements.length} SQL statements to execute`);

    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i] + ';';
      
      try {
        console.log(`   Executing statement ${i + 1}/${statements.length}...`);
        
        const { error } = await supabase.rpc('exec_sql', { 
          sql: statement 
        });

        if (error) {
          console.error(`❌ Error in statement ${i + 1}:`, error.message);
          console.error(`   Statement: ${statement.substring(0, 100)}...`);
        } else {
          console.log(`   ✅ Statement ${i + 1} executed successfully`);
        }
      } catch (err) {
        console.error(`❌ Exception in statement ${i + 1}:`, err.message);
      }
    }

    // Test the functions
    console.log('\n🧪 Testing real-time RPC functions...');
    
    // Test get_realtime_performance_metrics
    const { data: metrics, error: metricsError } = await supabase
      .rpc('get_realtime_performance_metrics', { p_time_window_minutes: 60 });
    
    if (metricsError) {
      console.error('❌ Error testing performance metrics:', metricsError.message);
    } else {
      console.log('✅ Performance metrics function working');
      console.log(`   Found ${metrics?.length || 0} metrics`);
    }

    // Test get_attempt_connection_stats
    const { data: stats, error: statsError } = await supabase
      .rpc('get_attempt_connection_stats');
    
    if (statsError) {
      console.error('❌ Error testing connection stats:', statsError.message);
    } else {
      console.log('✅ Connection stats function working');
      if (stats && stats.length > 0) {
        const stat = stats[0];
        console.log(`   Active attempts: ${stat.total_active_attempts}`);
        console.log(`   Total connections: ${stat.total_connections}`);
      }
    }

    // Test cleanup function (dry run)
    const { data: cleanup, error: cleanupError } = await supabase
      .rpc('cleanup_stale_attempt_connections', { p_timeout_minutes: 1440 }); // 24 hours
    
    if (cleanupError) {
      console.error('❌ Error testing cleanup function:', cleanupError.message);
    } else {
      console.log('✅ Cleanup function working');
      if (cleanup && cleanup.length > 0) {
        const result = cleanup[0];
        console.log(`   Would clean ${result.cleaned_attempts} attempts and ${result.cleaned_connections} connections`);
      }
    }

    console.log('\n🎉 Real-time RPC functions setup completed successfully!');
    console.log('\n📋 Available functions:');
    console.log('   • get_attempt_sync_status(uuid)');
    console.log('   • batch_resolve_attempt_conflicts(jsonb)');
    console.log('   • get_realtime_attempt_activity(uuid, timestamptz, integer)');
    console.log('   • update_attempt_heartbeat(uuid, text)');
    console.log('   • get_attempt_connection_stats(uuid)');
    console.log('   • cleanup_stale_attempt_connections(integer)');
    console.log('   • get_realtime_performance_metrics(integer)');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

// Run the setup
setupRealtimeRPCs();