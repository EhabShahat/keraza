#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');

// Load env and create Supabase client with service role
loadEnv();
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error('Missing env: NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required.');
  process.exit(1);
}
const supabase = createClient(url, serviceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function runMigration() {
  console.log('🚀 Starting Global Students Migration...');
  
  try {
    // Step 1: Create students table
    console.log('📝 Step 1: Creating students table...');
    await createStudentsTable();
    
    // Step 2: Create student_exam_attempts table
    console.log('📝 Step 2: Creating student_exam_attempts table...');
    await createStudentExamAttemptsTable();
    
    // Step 3: Migrate existing data
    console.log('📝 Step 3: Migrating existing exam_codes data...');
    await migrateExamCodesData();
    
    // Step 4: Add student_id column to exam_attempts
    console.log('📝 Step 4: Adding student_id column to exam_attempts...');
    await addStudentIdColumn();
    
    // Step 5: Update exam_attempts with student_id
    console.log('📝 Step 5: Updating exam_attempts with student_id...');
    await updateExamAttemptsWithStudentId();
    
    // Step 6: Create student_exam_attempts records
    console.log('📝 Step 6: Creating student_exam_attempts records...');
    await createStudentExamAttempts();
    
    console.log('🎉 Migration completed successfully!');
    
    // Verify the migration
    await verifyMigration();
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    console.error('Stack:', error.stack);
    process.exit(1);
  }
}

async function createStudentsTable() {
  // Check if table already exists
  const { data: existingTable } = await supabase
    .from('students')
    .select('id')
    .limit(1);
  
  if (existingTable !== null) {
    console.log('✅ Students table already exists');
    return;
  }
  
  // Create using a simple approach - we'll use the SQL editor or manual creation
  console.log('⚠️  Students table needs to be created manually in Supabase SQL editor');
  console.log('📋 SQL to run:');
  console.log(`
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  student_name text,
  mobile_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Grant permissions
GRANT SELECT ON public.students TO anon, authenticated;
GRANT ALL ON public.students TO service_role;
  `);
}

async function createStudentExamAttemptsTable() {
  // Check if table already exists
  const { data: existingTable } = await supabase
    .from('student_exam_attempts')
    .select('id')
    .limit(1);
  
  if (existingTable !== null) {
    console.log('✅ Student exam attempts table already exists');
    return;
  }
  
  console.log('⚠️  Student exam attempts table needs to be created manually in Supabase SQL editor');
  console.log('📋 SQL to run:');
  console.log(`
CREATE TABLE IF NOT EXISTS public.student_exam_attempts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
  exam_id uuid NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  attempt_id uuid REFERENCES public.exam_attempts(id) ON DELETE SET NULL,
  started_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz,
  status text NOT NULL DEFAULT 'in_progress' CHECK (status IN ('in_progress', 'completed', 'abandoned')),
  UNIQUE(student_id, exam_id)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_student_exam ON public.student_exam_attempts(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_exam ON public.student_exam_attempts(exam_id);

-- Grant permissions
GRANT SELECT ON public.student_exam_attempts TO anon, authenticated;
GRANT ALL ON public.student_exam_attempts TO service_role;
  `);
}

async function migrateExamCodesData() {
  try {
    // First check if students table exists and is accessible
    const { data: studentsCheck, error: studentsError } = await supabase
      .from('students')
      .select('count')
      .limit(1);
    
    if (studentsError) {
      console.log('⚠️  Students table not ready yet. Please create it first using the SQL above.');
      return;
    }
    
    // Get all exam codes with their data
    const { data: examCodes, error } = await supabase
      .from('exam_codes')
      .select('code, student_name, mobile_number, generated_at')
      .not('code', 'is', null);
    
    if (error) {
      throw new Error(`Failed to fetch exam codes: ${error.message}`);
    }
    
    if (!examCodes || examCodes.length === 0) {
      console.log('⚠️  No exam codes found to migrate');
      return;
    }
    
    // Group by code to get unique students
    const uniqueStudents = new Map();
    
    examCodes.forEach(code => {
      if (!uniqueStudents.has(code.code)) {
        uniqueStudents.set(code.code, {
          code: code.code,
          student_name: code.student_name,
          mobile_number: code.mobile_number,
          created_at: code.generated_at || new Date().toISOString()
        });
      }
    });
    
    const studentsToInsert = Array.from(uniqueStudents.values());
    
    console.log(`📊 Found ${studentsToInsert.length} unique students to migrate`);
    
    // Insert students in batches
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < studentsToInsert.length; i += batchSize) {
      const batch = studentsToInsert.slice(i, i + batchSize);
      
      const { data, error: insertError } = await supabase
        .from('students')
        .upsert(batch, { 
          onConflict: 'code',
          ignoreDuplicates: false 
        })
        .select('id');
      
      if (insertError) {
        console.error(`❌ Failed to insert batch ${Math.floor(i/batchSize) + 1}:`, insertError.message);
        // Continue with next batch
      } else {
        const inserted = data?.length || 0;
        totalInserted += inserted;
        console.log(`✅ Processed batch ${Math.floor(i/batchSize) + 1} (${inserted} students)`);
      }
    }
    
    console.log(`📊 Total students migrated: ${totalInserted}`);
    
  } catch (error) {
    console.error('❌ Data migration failed:', error.message);
    throw error;
  }
}

async function addStudentIdColumn() {
  // We can't directly alter tables via the client, so we'll check if the column exists
  const { data: attempts, error } = await supabase
    .from('exam_attempts')
    .select('student_id')
    .limit(1);
  
  if (error && error.message.includes('column "student_id" does not exist')) {
    console.log('⚠️  Need to add student_id column to exam_attempts table manually');
    console.log('📋 SQL to run:');
    console.log(`
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON public.exam_attempts(student_id);
    `);
    return false;
  } else {
    console.log('✅ Student_id column exists in exam_attempts');
    return true;
  }
}

async function updateExamAttemptsWithStudentId() {
  try {
    // Get exam attempts that don't have student_id but have code_id
    const { data: attempts, error } = await supabase
      .from('exam_attempts')
      .select(`
        id,
        code_id,
        exam_codes!inner(code)
      `)
      .is('student_id', null)
      .not('code_id', 'is', null);
    
    if (error) {
      console.log('⚠️  Could not fetch exam attempts for student_id update:', error.message);
      return;
    }
    
    if (!attempts || attempts.length === 0) {
      console.log('✅ No exam attempts need student_id updates');
      return;
    }
    
    console.log(`📊 Found ${attempts.length} exam attempts to update with student_id`);
    
    // Update in batches
    const batchSize = 50;
    let totalUpdated = 0;
    
    for (let i = 0; i < attempts.length; i += batchSize) {
      const batch = attempts.slice(i, i + batchSize);
      
      for (const attempt of batch) {
        const code = attempt.exam_codes?.code;
        if (!code) continue;
        
        // Get student_id for this code
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('code', code)
          .single();
        
        if (student) {
          const { error: updateError } = await supabase
            .from('exam_attempts')
            .update({ student_id: student.id })
            .eq('id', attempt.id);
          
          if (!updateError) {
            totalUpdated++;
          }
        }
      }
      
      console.log(`✅ Updated batch ${Math.floor(i/batchSize) + 1}`);
    }
    
    console.log(`📊 Total exam attempts updated: ${totalUpdated}`);
    
  } catch (error) {
    console.error('❌ Failed to update exam attempts:', error.message);
  }
}

async function createStudentExamAttempts() {
  try {
    // Check if student_exam_attempts table is ready
    const { data: tableCheck, error: tableError } = await supabase
      .from('student_exam_attempts')
      .select('count')
      .limit(1);
    
    if (tableError) {
      console.log('⚠️  Student exam attempts table not ready yet');
      return;
    }
    
    // Get exam attempts with student_id
    const { data: attempts, error } = await supabase
      .from('exam_attempts')
      .select('id, exam_id, student_id, started_at, submitted_at, completion_status')
      .not('student_id', 'is', null);
    
    if (error) {
      console.log('⚠️  Could not fetch exam attempts:', error.message);
      return;
    }
    
    if (!attempts || attempts.length === 0) {
      console.log('✅ No exam attempts found to create student_exam_attempts records');
      return;
    }
    
    console.log(`📊 Found ${attempts.length} exam attempts to process`);
    
    const studentExamAttempts = attempts.map(attempt => ({
      student_id: attempt.student_id,
      exam_id: attempt.exam_id,
      attempt_id: attempt.id,
      started_at: attempt.started_at,
      completed_at: attempt.submitted_at,
      status: attempt.completion_status === 'submitted' ? 'completed' : 
              attempt.completion_status === 'abandoned' ? 'abandoned' : 'in_progress'
    }));
    
    // Insert in batches
    const batchSize = 50;
    let totalInserted = 0;
    
    for (let i = 0; i < studentExamAttempts.length; i += batchSize) {
      const batch = studentExamAttempts.slice(i, i + batchSize);
      
      const { data, error: insertError } = await supabase
        .from('student_exam_attempts')
        .upsert(batch, { 
          onConflict: 'student_id,exam_id',
          ignoreDuplicates: true 
        })
        .select('id');
      
      if (insertError) {
        console.error(`❌ Failed to insert student exam attempts batch ${Math.floor(i/batchSize) + 1}:`, insertError.message);
      } else {
        const inserted = data?.length || 0;
        totalInserted += inserted;
        console.log(`✅ Processed student exam attempts batch ${Math.floor(i/batchSize) + 1} (${inserted} records)`);
      }
    }
    
    console.log(`📊 Total student exam attempts created: ${totalInserted}`);
    
  } catch (error) {
    console.error('❌ Failed to create student exam attempts:', error.message);
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');
  
  try {
    // Check students table
    const { count: studentCount, error: studentsError } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
    
    if (studentsError) {
      console.log('❌ Students table verification failed:', studentsError.message);
    } else {
      console.log(`✅ Students table: ${studentCount || 0} records`);
    }
    
    // Check student_exam_attempts table
    const { count: attemptCount, error: attemptsError } = await supabase
      .from('student_exam_attempts')
      .select('*', { count: 'exact', head: true });
    
    if (attemptsError) {
      console.log('❌ Student exam attempts table verification failed:', attemptsError.message);
    } else {
      console.log(`✅ Student exam attempts table: ${attemptCount || 0} records`);
    }
    
    // Check exam_attempts with student_id
    const { count: examAttemptCount, error: examAttemptsError } = await supabase
      .from('exam_attempts')
      .select('*', { count: 'exact', head: true })
      .not('student_id', 'is', null);
    
    if (examAttemptsError) {
      console.log('❌ Exam attempts with student_id verification failed:', examAttemptsError.message);
    } else {
      console.log(`✅ Exam attempts with student_id: ${examAttemptCount || 0} records`);
    }
    
    console.log('\n✅ Migration verification completed!');
    
  } catch (error) {
    console.error('❌ Migration verification failed:', error.message);
  }
}

// Run the migration
runMigration().catch(error => {
  console.error('💥 Migration script failed:', error);
  process.exit(1);
});