#!/usr/bin/env node

/**
 * Test script to check database access and run simple migration steps
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

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('❌ Missing required environment variables:');
  console.error('   NEXT_PUBLIC_SUPABASE_URL');
  console.error('   NEXT_PUBLIC_SUPABASE_ANON_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function testDatabase() {
  console.log('🚀 Testing database access...');

  try {
    // Test basic access
    const { data: exams, error: examsError } = await supabase
      .from('exams')
      .select('id, title')
      .limit(1);

    if (examsError) {
      console.error('❌ Cannot access exams table:', examsError.message);
      return;
    }

    console.log('✅ Database access successful');
    console.log('📊 Found', exams?.length || 0, 'exams');

    // Check if students table already exists
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('*')
      .limit(1);

    if (studentsError) {
      console.log('ℹ️  Students table does not exist yet:', studentsError.message);
    } else {
      console.log('✅ Students table already exists with', students?.length || 0, 'records');
    }

    // Check exam_codes table
    const { data: codes, error: codesError } = await supabase
      .from('exam_codes')
      .select('id, code, student_name, exam_id')
      .limit(5);

    if (codesError) {
      console.error('❌ Cannot access exam_codes table:', codesError.message);
    } else {
      console.log('✅ Found', codes?.length || 0, 'exam codes to migrate');
      if (codes && codes.length > 0) {
        console.log('📋 Sample codes:', codes.map(c => ({ code: c.code, name: c.student_name })));
      }
    }

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

testDatabase();