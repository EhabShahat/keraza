#!/usr/bin/env node

/**
 * Data migration script for Global Student Management System
 * This migrates existing exam_codes data to the new global students system
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
  console.error('❌ Missing required environment variables');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function migrateData() {
  console.log('🚀 Starting data migration to global students...');

  try {
    // Get all unique exam codes
    const { data: examCodes, error: codesError } = await supabase
      .from('exam_codes')
      .select('*')
      .order('generated_at');

    if (codesError) {
      console.error('❌ Failed to fetch exam codes:', codesError.message);
      return;
    }

    console.log(`📋 Found ${examCodes.length} exam codes to process`);

    // Group codes by unique combination of code, name, mobile
    const uniqueStudents = new Map();
    
    for (const code of examCodes) {
      const key = `${code.code || 'NULL'}_${code.student_name || 'NULL'}_${code.mobile_number || 'NULL'}`;
      
      if (!uniqueStudents.has(key)) {
        uniqueStudents.set(key, {
          code: code.code,
          student_name: code.student_name,
          mobile_number: code.mobile_number,
          created_at: code.generated_at,
          exam_codes: []
        });
      }
      
      uniqueStudents.get(key).exam_codes.push(code);
    }

    console.log(`👥 Identified ${uniqueStudents.size} unique students`);

    // Check existing students to avoid duplicates
    const { data: existingStudents, error: existingError } = await supabase
      .from('students')
      .select('code');

    if (existingError) {
      console.error('❌ Failed to check existing students:', existingError.message);
      return;
    }

    const existingCodes = new Set(existingStudents.map(s => s.code));
    console.log(`📊 Found ${existingCodes.size} existing students`);

    // Prepare students to insert
    const studentsToInsert = [];
    const codeMapping = new Map(); // old exam_code.id -> new student.id

    for (const [key, student] of uniqueStudents) {
      if (!student.code || existingCodes.has(student.code)) {
        console.log(`⏭️  Skipping duplicate code: ${student.code}`);
        continue;
      }

      studentsToInsert.push({
        code: student.code,
        student_name: student.student_name,
        mobile_number: student.mobile_number,
        created_at: student.created_at
      });
    }

    if (studentsToInsert.length === 0) {
      console.log('ℹ️  No new students to insert');
    } else {
      console.log(`📝 Inserting ${studentsToInsert.length} new students...`);
      
      const { data: insertedStudents, error: insertError } = await supabase
        .from('students')
        .insert(studentsToInsert)
        .select('*');

      if (insertError) {
        console.error('❌ Failed to insert students:', insertError.message);
        return;
      }

      console.log(`✅ Successfully inserted ${insertedStudents.length} students`);
    }

    // Now get all students for mapping
    const { data: allStudents, error: allStudentsError } = await supabase
      .from('students')
      .select('*');

    if (allStudentsError) {
      console.error('❌ Failed to fetch all students:', allStudentsError.message);
      return;
    }

    // Create mapping from code to student_id
    const codeToStudentId = new Map();
    for (const student of allStudents) {
      codeToStudentId.set(student.code, student.id);
    }

    // Update exam_attempts with student_id
    console.log('🔄 Updating exam_attempts with student_id...');
    
    const { data: attempts, error: attemptsError } = await supabase
      .from('exam_attempts')
      .select('id, code_id, exam_codes(code)')
      .not('code_id', 'is', null);

    if (attemptsError) {
      console.error('❌ Failed to fetch exam attempts:', attemptsError.message);
      return;
    }

    console.log(`📋 Found ${attempts.length} attempts to update`);

    for (const attempt of attempts) {
      const code = attempt.exam_codes?.code;
      const studentId = codeToStudentId.get(code);
      
      if (studentId) {
        const { error: updateError } = await supabase
          .from('exam_attempts')
          .update({ student_id: studentId })
          .eq('id', attempt.id);

        if (updateError) {
          console.warn(`⚠️  Failed to update attempt ${attempt.id}:`, updateError.message);
        }
      }
    }

    console.log('✅ Exam attempts updated with student_id');

    // Create student_exam_attempts records
    console.log('📝 Creating student exam attempt tracking records...');
    
    const { data: attemptsWithStudents, error: attemptsWithStudentsError } = await supabase
      .from('exam_attempts')
      .select('id, exam_id, student_id, started_at, submitted_at, completion_status')
      .not('student_id', 'is', null);

    if (attemptsWithStudentsError) {
      console.error('❌ Failed to fetch attempts with students:', attemptsWithStudentsError.message);
      return;
    }

    const studentExamAttempts = [];
    for (const attempt of attemptsWithStudents) {
      studentExamAttempts.push({
        student_id: attempt.student_id,
        exam_id: attempt.exam_id,
        attempt_id: attempt.id,
        started_at: attempt.started_at,
        completed_at: attempt.submitted_at,
        status: attempt.completion_status === 'submitted' ? 'completed' : 
                attempt.completion_status === 'abandoned' ? 'abandoned' : 'in_progress'
      });
    }

    if (studentExamAttempts.length > 0) {
      const { data: insertedAttempts, error: attemptsInsertError } = await supabase
        .from('student_exam_attempts')
        .insert(studentExamAttempts)
        .select('*');

      if (attemptsInsertError) {
        console.error('❌ Failed to insert student exam attempts:', attemptsInsertError.message);
      } else {
        console.log(`✅ Created ${insertedAttempts.length} student exam attempt records`);
      }
    }

    // Final verification
    const { count: finalStudentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    const { count: finalAttemptCount } = await supabase
      .from('student_exam_attempts')
      .select('*', { count: 'exact', head: true });

    console.log('');
    console.log('✅ Migration completed successfully!');
    console.log('');
    console.log('📊 Final results:');
    console.log(`   - Total students: ${finalStudentCount || 0}`);
    console.log(`   - Total exam attempts tracked: ${finalAttemptCount || 0}`);
    console.log('');
    console.log('📋 Next steps:');
    console.log('   1. Go to /admin/students to manage global students');
    console.log('   2. Students can now use codes across multiple exams');
    console.log('   3. Each exam can only be attempted once per student');

  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    process.exit(1);
  }
}

migrateData();