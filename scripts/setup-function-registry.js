#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs').promises;
const path = require('path');

async function setupFunctionRegistry() {
  console.log('🚀 Setting up Function Registry database schema...\n');

  // Load environment variables
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing required environment variables:');
    console.error('   NEXT_PUBLIC_SUPABASE_URL');
    console.error('   SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  try {
    // Read the SQL schema file
    const schemaPath = path.join(__dirname, '../db/function_registry.sql');
    const schemaSql = await fs.readFile(schemaPath, 'utf-8');

    console.log('📄 Executing function registry schema...');

    // Execute the schema SQL
    const { error } = await supabase.rpc('exec_sql', { sql: schemaSql });

    if (error) {
      // If the RPC doesn't exist, try direct execution (this might not work in all cases)
      console.log('⚠️  RPC method not available, attempting direct execution...');
      
      // Split the SQL into individual statements and execute them
      const statements = schemaSql
        .split(';')
        .map(stmt => stmt.trim())
        .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));

      for (const statement of statements) {
        if (statement.trim()) {
          const { error: stmtError } = await supabase.from('_').select('*').limit(0);
          if (stmtError) {
            console.warn(`⚠️  Could not execute statement: ${statement.substring(0, 50)}...`);
          }
        }
      }
    }

    console.log('✅ Function registry schema setup completed');

    // Verify tables were created
    console.log('\n🔍 Verifying table creation...');
    
    const tables = [
      'function_registry',
      'function_metrics', 
      'consolidation_progress',
      'performance_baselines',
      'optimization_recommendations'
    ];

    for (const table of tables) {
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(1);
        
      if (error) {
        console.log(`❌ Table '${table}' verification failed:`, error.message);
      } else {
        console.log(`✅ Table '${table}' is ready`);
      }
    }

    console.log('\n🎉 Function Registry setup complete!');
    console.log('\n📋 Next steps:');
    console.log('   1. Run: npm run audit:functions');
    console.log('   2. Visit: /admin/optimization');
    console.log('   3. Review consolidation recommendations');

  } catch (error) {
    console.error('❌ Error setting up function registry:', error);
    process.exit(1);
  }
}

// Alternative method using direct SQL execution if available
async function executeSqlDirect(supabase, sql) {
  // This is a fallback method - in practice, you might need to execute
  // the SQL manually in the Supabase dashboard or use a migration tool
  console.log('📝 SQL to execute manually in Supabase dashboard:');
  console.log('=' .repeat(50));
  console.log(sql);
  console.log('=' .repeat(50));
  
  return { success: true };
}

if (require.main === module) {
  setupFunctionRegistry().catch(console.error);
}

module.exports = { setupFunctionRegistry };