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
const supabase = createClient(url, serviceKey, { auth: { autoRefreshToken: false, persistSession: false } });

async function createStudentsTable() {
  console.log('🚀 Creating students table...');
  
  try {
    // Test if we can connect
    const { data: testData, error: testError } = await supabase
      .from('exams')
      .select('count')
      .limit(1);
    
    if (testError) {
      console.error('❌ Connection test failed:', testError.message);
      return;
    }
    
    console.log('✅ Connection successful');
    
    // Check if students table already exists
    const { data: existingStudents, error: studentsError } = await supabase
      .from('students')
      .select('count')
      .limit(1);
    
    if (!studentsError) {
      console.log('✅ Students table already exists');
      
      // Check count
      const { count } = await supabase
        .from('students')
        .select('*', { count: 'exact', head: true });
      
      console.log(`📊 Current students count: ${count || 0}`);
      return;
    }
    
    console.log('📝 Students table does not exist, need to create it manually');
    console.log('');
    console.log('🔧 Please run this SQL in your Supabase SQL Editor:');
    console.log('');
    console.log(`-- Create students table
CREATE TABLE IF NOT EXISTS public.students (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text UNIQUE NOT NULL,
  student_name text,
  mobile_number text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_students_code ON public.students(code);
CREATE INDEX IF NOT EXISTS idx_students_mobile ON public.students(mobile_number);

-- Grant permissions
GRANT SELECT ON public.students TO anon, authenticated;
GRANT ALL ON public.students TO service_role;

-- Create student_exam_attempts table
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

-- Create indexes for student_exam_attempts
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_student_exam ON public.student_exam_attempts(student_id, exam_id);
CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_exam ON public.student_exam_attempts(exam_id);

-- Grant permissions
GRANT SELECT ON public.student_exam_attempts TO anon, authenticated;
GRANT ALL ON public.student_exam_attempts TO service_role;

-- Add student_id column to exam_attempts
ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_exam_attempts_student_id ON public.exam_attempts(student_id);

-- Create helper view
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

-- Grant permissions on view
GRANT SELECT ON public.student_exam_summary TO anon, authenticated;

-- Create clear students function
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

-- Grant execute permission
GRANT EXECUTE ON FUNCTION public.clear_all_students TO service_role;`);
    
    console.log('');
    console.log('📋 After running the SQL:');
    console.log('   1. Run this script again to verify');
    console.log('   2. Go to /admin/students to test the interface');
    
  } catch (error) {
    console.error('💥 Script failed:', error.message);
  }
}

createStudentsTable();