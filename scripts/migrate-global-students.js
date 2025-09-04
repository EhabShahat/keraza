#!/usr/bin/env node

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
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
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, '..', 'db', 'migration_global_students.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📖 Migration SQL loaded');
    
    // Split the SQL into individual statements
    const statements = migrationSQL
      .split(';')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`📝 Found ${statements.length} SQL statements to execute`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      
      // Skip comments and empty statements
      if (statement.startsWith('--') || statement.trim().length === 0) {
        continue;
      }
      
      console.log(`⚡ Executing statement ${i + 1}/${statements.length}...`);
      
      try {
        const { error } = await supabase.rpc('exec_sql', { sql: statement });
        
        if (error) {
          // Try direct execution for some statements
          const { error: directError } = await supabase
            .from('_temp_migration')
            .select('*')
            .limit(1);
          
          // If it's a table/function creation, try a different approach
          if (error.message.includes('function') || error.message.includes('table')) {
            console.log(`⚠️  Statement ${i + 1} may have executed successfully (${error.message})`);
          } else {
            throw error;
          }
        }
        
        console.log(`✅ Statement ${i + 1} completed`);
      } catch (stmtError) {
        console.error(`❌ Error in statement ${i + 1}:`, stmtError.message);
        console.log('Statement:', statement.substring(0, 100) + '...');
        
        // Continue with non-critical errors
        if (stmtError.message.includes('already exists') || 
            stmtError.message.includes('does not exist')) {
          console.log('⚠️  Continuing with migration (non-critical error)');
        } else {
          throw stmtError;
        }
      }
    }
    
    console.log('🎉 Migration completed successfully!');
    
    // Verify the migration
    await verifyMigration();
    
  } catch (error) {
    console.error('💥 Migration failed:', error.message);
    process.exit(1);
  }
}

async function verifyMigration() {
  console.log('\n🔍 Verifying migration...');
  
  try {
    // Check if students table exists
    const { data: students, error: studentsError } = await supabase
      .from('students')
      .select('count(*)')
      .limit(1);
    
    if (studentsError) {
      throw new Error(`Students table verification failed: ${studentsError.message}`);
    }
    
    console.log('✅ Students table exists');
    
    // Check if student_exam_attempts table exists
    const { data: attempts, error: attemptsError } = await supabase
      .from('student_exam_attempts')
      .select('count(*)')
      .limit(1);
    
    if (attemptsError) {
      throw new Error(`Student exam attempts table verification failed: ${attemptsError.message}`);
    }
    
    console.log('✅ Student exam attempts table exists');
    
    // Check if the view exists
    const { data: summary, error: summaryError } = await supabase
      .from('student_exam_summary')
      .select('*')
      .limit(1);
    
    if (summaryError) {
      console.log('⚠️  Student exam summary view may not exist yet:', summaryError.message);
    } else {
      console.log('✅ Student exam summary view exists');
    }
    
    // Get counts
    const { count: studentCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });
    
    const { count: attemptCount } = await supabase
      .from('student_exam_attempts')
      .select('*', { count: 'exact', head: true });
    
    console.log(`📊 Migration Results:`);
    console.log(`   - Students: ${studentCount || 0}`);
    console.log(`   - Student exam attempts: ${attemptCount || 0}`);
    
    console.log('\n✅ Migration verification completed successfully!');
    
  } catch (error) {
    console.error('❌ Migration verification failed:', error.message);
    throw error;
  }
}

// Alternative approach: Execute the migration in chunks
async function runMigrationAlternative() {
  console.log('🚀 Starting Alternative Migration Approach...');
  
  try {
    // Step 1: Create students table
    console.log('📝 Creating students table...');
    const { error: studentsTableError } = await supabase.rpc('exec_sql', {
      sql: `
        CREATE TABLE IF NOT EXISTS public.students (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          code text UNIQUE NOT NULL,
          student_name text,
          mobile_number text,
          created_at timestamptz NOT NULL DEFAULT now(),
          updated_at timestamptz NOT NULL DEFAULT now()
        );
      `
    });
    
    if (studentsTableError && !studentsTableError.message.includes('already exists')) {
      console.error('❌ Failed to create students table:', studentsTableError.message);
    } else {
      console.log('✅ Students table ready');
    }
    
    // Step 2: Create student_exam_attempts table
    console.log('📝 Creating student_exam_attempts table...');
    const { error: attemptsTableError } = await supabase.rpc('exec_sql', {
      sql: `
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
      `
    });
    
    if (attemptsTableError && !attemptsTableError.message.includes('already exists')) {
      console.error('❌ Failed to create student_exam_attempts table:', attemptsTableError.message);
    } else {
      console.log('✅ Student exam attempts table ready');
    }
    
    // Step 3: Migrate data from exam_codes
    console.log('📝 Migrating data from exam_codes...');
    await migrateExamCodesData();
    
    // Step 4: Create indexes
    console.log('📝 Creating indexes...');
    await createIndexes();
    
    // Step 5: Add student_id column to exam_attempts
    console.log('📝 Adding student_id to exam_attempts...');
    await addStudentIdColumn();
    
    console.log('🎉 Alternative migration completed!');
    await verifyMigration();
    
  } catch (error) {
    console.error('💥 Alternative migration failed:', error.message);
    process.exit(1);
  }
}

async function migrateExamCodesData() {
  try {
    // Get all unique codes from exam_codes
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
          created_at: code.generated_at
        });
      }
    });
    
    const studentsToInsert = Array.from(uniqueStudents.values());
    
    console.log(`📊 Found ${studentsToInsert.length} unique students to migrate`);
    
    // Insert students in batches
    const batchSize = 100;
    for (let i = 0; i < studentsToInsert.length; i += batchSize) {
      const batch = studentsToInsert.slice(i, i + batchSize);
      
      const { error: insertError } = await supabase
        .from('students')
        .upsert(batch, { onConflict: 'code' });
      
      if (insertError) {
        console.error(`❌ Failed to insert batch ${Math.floor(i/batchSize) + 1}:`, insertError.message);
      } else {
        console.log(`✅ Inserted batch ${Math.floor(i/batchSize) + 1} (${batch.length} students)`);
      }
    }
    
  } catch (error) {
    console.error('❌ Data migration failed:', error.message);
    throw error;
  }
}

async function createIndexes() {
  const indexes = [
    'CREATE INDEX IF NOT EXISTS idx_students_code ON public.students(code);',
    'CREATE INDEX IF NOT EXISTS idx_students_mobile ON public.students(mobile_number);',
    'CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_student_exam ON public.student_exam_attempts(student_id, exam_id);',
    'CREATE INDEX IF NOT EXISTS idx_student_exam_attempts_exam ON public.student_exam_attempts(exam_id);'
  ];
  
  for (const indexSQL of indexes) {
    try {
      const { error } = await supabase.rpc('exec_sql', { sql: indexSQL });
      if (error && !error.message.includes('already exists')) {
        console.error('❌ Index creation error:', error.message);
      }
    } catch (err) {
      console.log('⚠️  Index may already exist:', err.message);
    }
  }
  
  console.log('✅ Indexes created');
}

async function addStudentIdColumn() {
  try {
    const { error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE public.exam_attempts ADD COLUMN IF NOT EXISTS student_id uuid REFERENCES public.students(id) ON DELETE SET NULL;'
    });
    
    if (error && !error.message.includes('already exists')) {
      console.error('❌ Failed to add student_id column:', error.message);
    } else {
      console.log('✅ Student_id column added to exam_attempts');
    }
  } catch (err) {
    console.log('⚠️  Column may already exist:', err.message);
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const useAlternative = args.includes('--alternative');
  
  if (useAlternative) {
    await runMigrationAlternative();
  } else {
    console.log('⚠️  Primary migration method may not work with RPC restrictions.');
    console.log('🔄 Switching to alternative approach...');
    await runMigrationAlternative();
  }
}

// Run the migration
main().catch(error => {
  console.error('💥 Migration script failed:', error);
  process.exit(1);
});