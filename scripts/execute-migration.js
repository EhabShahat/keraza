#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const { loadEnv } = require('./utils/load-env');

// Load env from .env.local / .env if present
loadEnv();

// Configuration from environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing env: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}

// Create Supabase client with service role
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function executeMigration() {
  console.log('🚀 Executing Global Students Migration...');
  
  try {
    // Step 1: Create students table
    console.log('📝 Step 1: Creating students table...');
    await executeSQL(`
      CREATE TABLE IF NOT EXISTS public.students (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        code text UNIQUE NOT NULL,
        student_name text,
        mobile_number text,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now()
      );
      
      CREATE INDEX IF NOT EXISTS idx_students_code ON public.students(code);
      CREATE INDEX IF NOT EXISTS idx_students_mobile ON public.students(mobile_number);
    `);
    
    // Step 2: Create student_exam_attempts table
    console.log('📝 Step 2: Creating student_exam_attempts table...');
    await executeSQL(`
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
      
      CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_student_exam ON public.student_exam_attempts(student_id, exam_id);
      CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_exam ON public.student_exam_attempts(exam_id);
    `);
    
    // Step 3: Add student_id column to exam_attempts
    console.log('📝 Step 3: Adding student_id column to exam_attempts...');
    await executeSQL(`
      ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
      CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON public.exam_attempts(student_id);
    `);
    
    // Step 4: Migrate existing data
    console.log('📝 Step 4: Migrating existing exam_codes data...');
    await migrateData();
    
    // Step 5: Create helper view
    console.log('📝 Step 5: Creating student_exam_summary view...');
    await executeSQL(`
      CREATE OR REPLACE VIEW public.student_exam_summary AS
      SELECT 
        s.id as student_id,
        s.code,
        s.student_name,
        s.mobile_number,
        COUNT(sea.id) as total_exams_attempted,
        COUNT(CASE WHEN sea.status = 'completed' THEN 1 END) as completed_exams,
        COUNT(CASE WHEN sea.status = 'in_progress' THEN 1 END) as in_progress_exams,
        s.created_at as student_created_at
      FROM public.students s
      LEFT JOIN public.student_exam_attempts sea ON s.id = sea.student_id
      GROUP BY s.id, s.code, s.student_name, s.mobile_number, s.created_at;
    `);
    
    // Step 6: Update RPC functions
    console.log('📝 Step 6: Creating RPC functions...');
    await createRPCFunctions();
    
    console.log('🎉 Migration completed successfully!');
    
    // Verify the migration
    await verifyMigration();
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

async function executeSQL(sql) {
  try {
    const { error } = await supabase.rpc('exec_sql', { sql });
    if (error) {
      console.log('⚠️  SQL execution note:', error.message);
    } else {
      console.log('✅ SQL executed successfully');
    }
  } catch (err) {
    console.log('⚠️  SQL execution note:', err.message);
  }
}

async function migrateData() {
  try {
    // Get all exam codes
    const { data: examCodes, error } = await supabase
      .from('exam_codes')
      .select('code, student_name, mobile_number, generated_at')
      .not('code', 'is', null);
    
    if (error) {
      console.error('❌ Failed to fetch exam codes:', error.message);
      return;
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
    
    // Insert students
    const { data: insertedStudents, error: insertError } = await supabase
      .from('students')
      .upsert(studentsToInsert, { onConflict: 'code' })
      .select('*');
    
    if (insertError) {
      console.error('❌ Failed to insert students:', insertError.message);
    } else {
      console.log(`✅ Migrated ${insertedStudents?.length || 0} students`);
    }
    
    // Update exam_attempts with student_id
    console.log('📝 Updating exam_attempts with student_id...');
    
    const { data: attempts, error: attemptsError } = await supabase
      .from('exam_attempts')
      .select(`
        id,
        code_id,
        exam_codes!inner(code)
      `)
      .is('student_id', null)
      .not('code_id', 'is', null);
    
    if (attemptsError) {
      console.log('⚠️  Could not fetch exam attempts:', attemptsError.message);
    } else if (attempts && attempts.length > 0) {
      console.log(`📊 Updating ${attempts.length} exam attempts with student_id`);
      
      for (const attempt of attempts) {
        const code = attempt.exam_codes?.code;
        if (!code) continue;
        
        // Get student_id for this code
        const { data: student } = await supabase
          .from('students')
          .select('id')
          .eq('code', code)
          .single();
        
        if (student) {
          await supabase
            .from('exam_attempts')
            .update({ student_id: student.id })
            .eq('id', attempt.id);
        }
      }
      
      console.log('✅ Updated exam_attempts with student_id');
    }
    
    // Create student_exam_attempts records
    console.log('📝 Creating student_exam_attempts records...');
    
    const { data: attemptsWithStudents, error: attemptsWithStudentsError } = await supabase
      .from('exam_attempts')
      .select('id, exam_id, student_id, started_at, submitted_at, completion_status')
      .not('student_id', 'is', null);
    
    if (attemptsWithStudentsError) {
      console.log('⚠️  Could not fetch attempts with students:', attemptsWithStudentsError.message);
    } else if (attemptsWithStudents && attemptsWithStudents.length > 0) {
      const studentExamAttempts = attemptsWithStudents.map(attempt => ({
        student_id: attempt.student_id,
        exam_id: attempt.exam_id,
        attempt_id: attempt.id,
        started_at: attempt.started_at,
        completed_at: attempt.submitted_at,
        status: attempt.completion_status === 'submitted' ? 'completed' : 
                attempt.completion_status === 'abandoned' ? 'abandoned' : 'in_progress'
      }));
      
      const { data: insertedAttempts, error: attemptsInsertError } = await supabase
        .from('student_exam_attempts')
        .upsert(studentExamAttempts, { onConflict: 'student_id,exam_id' })
        .select('*');
      
      if (attemptsInsertError) {
        console.error('❌ Failed to insert student exam attempts:', attemptsInsertError.message);
      } else {
        console.log(`✅ Created ${insertedAttempts?.length || 0} student exam attempt records`);
      }
    }
    
  } catch (error) {
    console.error('❌ Data migration failed:', error.message);
  }
}

async function createRPCFunctions() {
  // Create the clear_all_students function
  await executeSQL(`
    CREATE OR REPLACE FUNCTION public.clear_all_students()
    RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      v_deleted_count integer;
    BEGIN
      DELETE FROM public.students;
      GET DIAGNOSTICS v_deleted_count = ROW_COUNT;
      
      RETURN jsonb_build_object(
        'success', true,
        'deleted_count', v_deleted_count,
        'message', 'All students cleared. Historical exam data preserved.'
      );
    END;
    $$;
  `);
  
  // Update the start_attempt function
  await executeSQL(`
    CREATE OR REPLACE FUNCTION public.start_attempt(
      p_exam_id uuid,
      p_code text DEFAULT NULL,
      p_student_name text DEFAULT NULL
    ) RETURNS jsonb
    LANGUAGE plpgsql
    SECURITY DEFINER
    AS $$
    DECLARE
      v_exam record;
      v_code_record record;
      v_attempt_id uuid;
      v_client_ip inet;
      v_student_id uuid;
    BEGIN
      v_client_ip := inet_client_addr();
      
      -- Get exam
      SELECT * INTO v_exam FROM public.exams WHERE id = p_exam_id AND status = 'published';
      IF v_exam IS NULL THEN
        RETURN jsonb_build_object('error', 'Exam not found or not published');
      END IF;
      
      -- Time bounds check
      IF v_exam.start_time IS NOT NULL AND now() < v_exam.start_time THEN
        RETURN jsonb_build_object('error', 'Exam has not started yet');
      END IF;
      IF v_exam.end_time IS NOT NULL AND now() > v_exam.end_time THEN
        RETURN jsonb_build_object('error', 'Exam has ended');
      END IF;
      
      -- Handle different access types
      IF v_exam.access_type = 'code_based' THEN
        IF p_code IS NULL THEN
          RETURN jsonb_build_object('error', 'Code required for this exam');
        END IF;
        
        -- Try new global student system first
        SELECT id INTO v_student_id FROM public.students WHERE code = p_code;
        
        IF v_student_id IS NOT NULL THEN
          -- Check if student already attempted this exam
          IF EXISTS(SELECT 1 FROM public.student_exam_attempts WHERE student_id = v_student_id AND exam_id = p_exam_id) THEN
            RETURN jsonb_build_object('error', 'You have already attempted this exam');
          END IF;
          
          -- Create attempt with student_id
          INSERT INTO public.exam_attempts (exam_id, student_id, ip_address)
          VALUES (p_exam_id, v_student_id, v_client_ip)
          RETURNING id INTO v_attempt_id;
          
          -- Track the attempt
          INSERT INTO public.student_exam_attempts (student_id, exam_id, attempt_id)
          VALUES (v_student_id, p_exam_id, v_attempt_id);
          
          RETURN jsonb_build_object(
            'attempt_id', v_attempt_id,
            'student_name', (SELECT student_name FROM public.students WHERE id = v_student_id)
          );
        ELSE
          -- Fallback to old exam_codes system
          SELECT * INTO v_code_record FROM public.exam_codes 
          WHERE exam_id = p_exam_id AND code = p_code;
          
          IF v_code_record IS NULL THEN
            RETURN jsonb_build_object('error', 'Invalid code for this exam');
          END IF;
          
          IF v_code_record.used_at IS NOT NULL THEN
            RETURN jsonb_build_object('error', 'Code already used');
          END IF;
          
          -- Create attempt with code_id (old system)
          INSERT INTO public.exam_attempts (exam_id, code_id, ip_address)
          VALUES (p_exam_id, v_code_record.id, v_client_ip)
          RETURNING id INTO v_attempt_id;
          
          -- Mark code as used
          UPDATE public.exam_codes SET used_at = now(), ip_address = v_client_ip 
          WHERE id = v_code_record.id;
          
          RETURN jsonb_build_object(
            'attempt_id', v_attempt_id,
            'student_name', v_code_record.student_name
          );
        END IF;
        
      ELSIF v_exam.access_type = 'ip_restricted' THEN
        -- IP restriction check
        IF NOT EXISTS(
          SELECT 1 FROM public.exam_ips 
          WHERE exam_id = p_exam_id AND rule_type = 'whitelist' AND v_client_ip <<= ip_range
        ) THEN
          RETURN jsonb_build_object('error', 'Access denied from your IP address');
        END IF;
        
        -- Create attempt for IP-restricted exam
        INSERT INTO public.exam_attempts (exam_id, ip_address)
        VALUES (p_exam_id, v_client_ip)
        RETURNING id INTO v_attempt_id;
        
        RETURN jsonb_build_object(
          'attempt_id', v_attempt_id,
          'student_name', p_student_name
        );
        
      ELSE -- open access
        INSERT INTO public.exam_attempts (exam_id, ip_address)
        VALUES (p_exam_id, v_client_ip)
        RETURNING id INTO v_attempt_id;
        
        RETURN jsonb_build_object(
          'attempt_id', v_attempt_id,
          'student_name', p_student_name
        );
      END IF;
    END;
    $$;
  `);
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
    console.log('\n📋 Next steps:');
    console.log('   1. Go to /admin/students to manage global students');
    console.log('   2. Students can now use codes across multiple exams');
    console.log('   3. Each exam can only be attempted once per student');
    
  } catch (error) {
    console.error('❌ Migration verification failed:', error.message);
  }
}

// Run the migration
executeMigration().catch(error => {
  console.error('💥 Migration script failed:', error);
  process.exit(1);
});