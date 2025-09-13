#!/usr/bin/env node

/**
 * Setup script for Supabase storage bucket
 * Run this script to create the logos bucket and set up RLS policies
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

async function setupStorage() {
  console.log('🚀 Setting up Supabase storage for logos...');

  try {
    // Create the logos bucket
    console.log('📁 Creating logos bucket...');
    const { data: bucket, error: bucketError } = await supabase.storage.createBucket('logos', {
      public: true,
      fileSizeLimit: 5242880, // 5MB
      allowedMimeTypes: [
        'image/jpeg',
        'image/jpg', 
        'image/png',
        'image/gif',
        'image/webp',
        'image/svg+xml'
      ]
    });

    if (bucketError && !bucketError.message.includes('already exists')) {
      throw bucketError;
    }

    if (bucketError?.message.includes('already exists')) {
      console.log('✅ Logos bucket already exists');
    } else {
      console.log('✅ Logos bucket created successfully');
    }

    // Read and execute the storage setup SQL
    console.log('🔐 Setting up RLS policies...');
    const sqlPath = path.join(__dirname, '..', 'db', 'storage_setup.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    // Split SQL into individual statements and execute them
    const statements = sql.split(';').filter(stmt => stmt.trim());
    
    for (const statement of statements) {
      if (statement.trim()) {
        const { error } = await supabase.rpc('exec_sql', { sql: statement.trim() + ';' });
        if (error && !error.message.includes('already exists')) {
          console.warn('⚠️  SQL warning:', error.message);
        }
      }
    }

    console.log('✅ Storage setup completed successfully!');
    console.log('');
    console.log('⚠️  IMPORTANT SECURITY NOTE:');
    console.log('   Logo upload is currently open to anyone for development purposes.');
    console.log('   This will be restricted to admin users only when admin authentication');
    console.log('   is fully implemented. Do not use in production without proper security!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Go to your admin settings page');
    console.log('   2. Upload a logo using the new upload component');
    console.log('   3. The logo will appear on all exam entry pages');
    console.log('   4. TODO: Implement proper admin-only access controls');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupStorage();