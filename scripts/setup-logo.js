#!/usr/bin/env node

/**
 * Quick setup script specifically for logo functionality
 * This ensures the minimal requirements are met for logo upload/display
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

async function setupLogo() {
  console.log('🚀 Setting up logo functionality...');

  try {
    // Step 1: Create minimal app_settings table
    console.log('📋 Creating app_settings table...');
    
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS public.app_settings (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        brand_name text,
        brand_logo_url text,
        created_at timestamptz DEFAULT now(),
        updated_at timestamptz DEFAULT now()
      );
    `;

    const { error: createError } = await supabase.rpc('exec_sql', { sql: createTableSQL });
    if (createError) {
      console.warn('⚠️  Create table warning:', createError.message);
    } else {
      console.log('✅ app_settings table ready');
    }

    // Step 2: Insert default row if none exists
    console.log('📝 Ensuring default settings row exists...');
    
    const { data: existing } = await supabase
      .from('app_settings')
      .select('id')
      .limit(1)
      .maybeSingle();

    if (!existing) {
      const { error: insertError } = await supabase
        .from('app_settings')
        .insert([{ brand_name: '', brand_logo_url: '' }]);
      
      if (insertError) {
        console.warn('⚠️  Insert warning:', insertError.message);
      } else {
        console.log('✅ Default settings row created');
      }
    } else {
      console.log('✅ Settings row already exists');
    }

    // Step 3: Test the public API
    console.log('🧪 Testing public settings API...');
    
    const { data: testData, error: testError } = await supabase
      .from('app_settings')
      .select('brand_name, brand_logo_url')
      .limit(1)
      .maybeSingle();

    if (testError) {
      console.error('❌ Test failed:', testError.message);
    } else {
      console.log('✅ Public API test successful');
      console.log('📊 Current settings:', testData);
    }

    // Step 4: Create storage bucket (if not exists)
    console.log('📁 Setting up storage bucket...');
    
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
      console.warn('⚠️  Storage bucket warning:', bucketError.message);
    } else {
      console.log('✅ Storage bucket ready');
    }

    console.log('');
    console.log('🎉 Logo functionality setup completed!');
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Go to /admin/settings');
    console.log('   2. Upload a logo');
    console.log('   3. Check /test-logo to verify it works');
    console.log('   4. Visit any exam page to see the logo');

  } catch (error) {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  }
}

setupLogo();