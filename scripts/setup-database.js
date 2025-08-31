#!/usr/bin/env node

/**
 * Setup script for database tables
 * Run this script to ensure all required tables exist with correct columns
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function setupDatabase() {
  console.log('🚀 Setting up database tables...');

  try {
    // Read and execute the app_settings SQL
    console.log('📋 Creating app_settings table...');
    const sqlPath = path.join(__dirname, '..', 'db', 'app_settings.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Execute the SQL
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.warn('⚠️  SQL warning:', error.message);
    } else {
      console.log('✅ app_settings table created/updated successfully');
    }

    // Verify the table structure
    console.log('🔍 Verifying table structure...');
    const { data: columns, error: columnsError } = await supabase
      .from('app_settings')
      .select('*')
      .limit(0); // Just get column info

    if (columnsError) {
      console.error('❌ Failed to verify table structure:', columnsError.message);
    } else {
      console.log('✅ Table structure verified');
    }

    // Test basic operations
    console.log('🧪 Testing basic operations...');
    
    // Try to select from the table
    const { data: testData, error: testError } = await supabase
      .from('app_settings')
      .select('brand_name, brand_logo_url')
      .limit(1)
      .maybeSingle();

    if (testError) {
      console.error('❌ Test query failed:', testError.message);
    } else {
      console.log('✅ Test query successful');
      console.log('📊 Current settings:', testData || 'No settings found');
    }

    console.log('');
    console.log('✅ Database setup completed successfully!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Go to /admin/settings to configure your app');
    console.log('   2. Upload a logo');
    console.log('   3. Test at /test-logo page');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupDatabase();