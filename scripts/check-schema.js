#!/usr/bin/env node

/**
 * Check current database schema
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Load environment variables manually
const envPath = path.join(__dirname, '..', '.env.local');
let supabaseUrl, supabaseAnonKey;

try {
  const envContent = fs.readFileSync(envPath, 'utf8');
  const envLines = envContent.split('\n');
  
  for (const line of envLines) {
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_URL=')) {
      supabaseUrl = line.split('=')[1].trim();
    }
    if (line.startsWith('NEXT_PUBLIC_SUPABASE_ANON_KEY=')) {
      supabaseAnonKey = line.split('=')[1].trim();
    }
  }
} catch (error) {
  console.error('❌ Could not read .env.local file');
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function checkSchema() {
  console.log('🔍 Checking database schema...');

  try {
    // Check what tables exist
    const tables = ['students', 'exam_codes', 'exam_attempts', 'student_exam_attempts'];
    
    for (const table of tables) {
      console.log(`\n📋 Checking table: ${table}`);
      
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .limit(0);

      if (error) {
        console.log(`❌ Table ${table} error:`, error.message);
      } else {
        console.log(`✅ Table ${table} exists`);
        
        // Try to get a sample record to see the structure
        const { data: sample, error: sampleError } = await supabase
          .from(table)
          .select('*')
          .limit(1);
          
        if (sample && sample.length > 0) {
          console.log(`📊 Sample structure:`, Object.keys(sample[0]));
        } else {
          console.log(`📊 Table is empty`);
        }
      }
    }

  } catch (error) {
    console.error('❌ Schema check failed:', error.message);
  }
}

checkSchema();