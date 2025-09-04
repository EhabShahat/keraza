#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');

(async function main() {
  loadEnv();

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
    process.exit(1);
  }

  const supabase = createClient(url, serviceKey);

  // Apply the specific migration for app_settings
  const migrations = [
    `ALTER TABLE IF EXISTS public.app_settings 
     ADD COLUMN IF NOT EXISTS code_format text DEFAULT 'numeric';`,
    
    `ALTER TABLE IF EXISTS public.app_settings 
     ADD COLUMN IF NOT EXISTS code_pattern text DEFAULT null;`,
     
    `ALTER TABLE IF EXISTS public.app_settings 
     ADD COLUMN IF NOT EXISTS code_length integer DEFAULT 4;`,
     
    `ALTER TABLE IF EXISTS public.app_settings 
     ADD COLUMN IF NOT EXISTS enable_multi_exam boolean DEFAULT true;`
  ];

  console.log('🔧 Fixing app_settings table schema...');

  for (const [idx, sql] of migrations.entries()) {
    console.log(`Applying migration ${idx + 1}/${migrations.length}...`);
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.error(`❌ Migration ${idx + 1} failed:`, error.message);
      process.exit(1);
    } else {
      console.log(`✅ Migration ${idx + 1} applied successfully`);
    }
  }

  console.log('🎉 App settings schema fixed successfully!');
})();
