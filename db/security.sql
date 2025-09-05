-- Security hardening and policies

-- Enable RLS on app_settings (idempotent)
ALTER TABLE public.app_settings ENABLE ROW LEVEL SECURITY;

-- Define/replace is_admin() used across RLS and RPCs
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path TO public, extensions
AS $$
DECLARE
  v_claims json;
  v_email text;
  v_sub_uuid uuid;
BEGIN
  BEGIN
    v_claims := coalesce(nullif(current_setting('request.jwt.claims', true), ''), '{}')::json;
  EXCEPTION WHEN others THEN
    v_claims := '{}'::json;
  END;
  v_email := lower(coalesce(v_claims->>'email',''));
  BEGIN
    v_sub_uuid := nullif(coalesce(v_claims->>'sub',''), '')::uuid;
  EXCEPTION WHEN others THEN
    v_sub_uuid := null;
  END;

  -- Trust server-side calls using the Supabase service role (either current_user or JWT role claim)
  IF current_user = 'service_role' OR lower(coalesce(v_claims->>'role','')) = 'service_role' THEN
    RETURN true;
  END IF;

  -- Otherwise, require that the JWT claims map to an admin in our table
  RETURN EXISTS (
    SELECT 1
    FROM public.admin_users au
    WHERE (v_sub_uuid IS NOT NULL AND au.user_id = v_sub_uuid)
       OR (coalesce(v_email, '') <> '' AND lower(au.email) = v_email)
  );
END;
$$;

-- Create/replace admin-only read policy using public.is_admin()
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'app_settings_admin_read'
  ) THEN
    EXECUTE 'DROP POLICY app_settings_admin_read ON public.app_settings';
  END IF;
  EXECUTE 'CREATE POLICY app_settings_admin_read ON public.app_settings FOR SELECT USING (public.is_admin())';
END $do$;

-- Create/replace admin-only write policy using public.is_admin()
DO $do$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'app_settings_admin_write'
  ) THEN
    EXECUTE 'DROP POLICY app_settings_admin_write ON public.app_settings';
  END IF;
  -- Consolidate app_settings policies into a single admin-all policy
  IF EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public' AND tablename = 'app_settings' AND policyname = 'app_settings_admin_all'
  ) THEN
    EXECUTE 'DROP POLICY app_settings_admin_all ON public.app_settings';
  END IF;
  EXECUTE 'CREATE POLICY app_settings_admin_all ON public.app_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

-- Enable RLS on core public tables (idempotent)
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exam_ips ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.students ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.student_exam_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Admin ALL policies (service role and admins)
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exams' AND policyname='exams_admin_all') THEN
    EXECUTE 'DROP POLICY exams_admin_all ON public.exams';
  END IF;
  EXECUTE 'CREATE POLICY exams_admin_all ON public.exams FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='questions' AND policyname='questions_admin_all') THEN
    EXECUTE 'DROP POLICY questions_admin_all ON public.questions';
  END IF;
  EXECUTE 'CREATE POLICY questions_admin_all ON public.questions FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exam_attempts' AND policyname='exam_attempts_admin_all') THEN
    EXECUTE 'DROP POLICY exam_attempts_admin_all ON public.exam_attempts';
  END IF;
  EXECUTE 'CREATE POLICY exam_attempts_admin_all ON public.exam_attempts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exam_results' AND policyname='exam_results_admin_all') THEN
    EXECUTE 'DROP POLICY exam_results_admin_all ON public.exam_results';
  END IF;
  EXECUTE 'CREATE POLICY exam_results_admin_all ON public.exam_results FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exam_ips' AND policyname='exam_ips_admin_all') THEN
    EXECUTE 'DROP POLICY exam_ips_admin_all ON public.exam_ips';
  END IF;
  EXECUTE 'CREATE POLICY exam_ips_admin_all ON public.exam_ips FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='audit_logs' AND policyname='audit_logs_admin_all') THEN
    EXECUTE 'DROP POLICY audit_logs_admin_all ON public.audit_logs';
  END IF;
  EXECUTE 'CREATE POLICY audit_logs_admin_all ON public.audit_logs FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='users' AND policyname='users_admin_all') THEN
    EXECUTE 'DROP POLICY users_admin_all ON public.users';
  END IF;
  EXECUTE 'CREATE POLICY users_admin_all ON public.users FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='admin_users' AND policyname='admin_users_admin_all') THEN
    EXECUTE 'DROP POLICY admin_users_admin_all ON public.admin_users';
  END IF;
  EXECUTE 'CREATE POLICY admin_users_admin_all ON public.admin_users FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='students' AND policyname='students_admin_all') THEN
    EXECUTE 'DROP POLICY students_admin_all ON public.students';
  END IF;
  EXECUTE 'CREATE POLICY students_admin_all ON public.students FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_exam_attempts' AND policyname='student_exam_attempts_admin_all') THEN
    EXECUTE 'DROP POLICY student_exam_attempts_admin_all ON public.student_exam_attempts';
  END IF;
  EXECUTE 'CREATE POLICY student_exam_attempts_admin_all ON public.student_exam_attempts FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_config' AND policyname='app_config_admin_all') THEN
    EXECUTE 'DROP POLICY app_config_admin_all ON public.app_config';
  END IF;
  EXECUTE 'CREATE POLICY app_config_admin_all ON public.app_config FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

-- Public SELECT policies where required by the app
-- Exams visible to public only when published
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exams' AND policyname='exams_public_read_published') THEN
    EXECUTE 'DROP POLICY exams_public_read_published ON public.exams';
  END IF;
  EXECUTE $$CREATE POLICY exams_public_read_published ON public.exams
    FOR SELECT TO anon
    USING (status = 'published')$$;
END $do$;

-- Exam attempts readable publicly only if they have results and belong to a published exam
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exam_attempts' AND policyname='exam_attempts_public_results_read') THEN
    EXECUTE 'DROP POLICY exam_attempts_public_results_read ON public.exam_attempts';
  END IF;
  EXECUTE $$CREATE POLICY exam_attempts_public_results_read ON public.exam_attempts
    FOR SELECT TO anon
    USING (
      EXISTS (SELECT 1 FROM public.exam_results er WHERE er.attempt_id = public.exam_attempts.id)
      AND EXISTS (
        SELECT 1 FROM public.exams ex
        WHERE ex.id = public.exam_attempts.exam_id AND ex.status = 'published'
      )
    )$$;
END $do$;

-- Exam results readable publicly only when the related exam is published
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exam_results' AND policyname='exam_results_public_read') THEN
    EXECUTE 'DROP POLICY exam_results_public_read ON public.exam_results';
  END IF;
  EXECUTE $$CREATE POLICY exam_results_public_read ON public.exam_results
    FOR SELECT TO anon
    USING (
      EXISTS (
        SELECT 1
        FROM public.exam_attempts ea
        JOIN public.exams ex ON ex.id = ea.exam_id
        WHERE ea.id = public.exam_results.attempt_id AND ex.status = 'published'
      )
    )$$;
END $do$;

-- Students readable for public results search (only those tied to published attempts)
-- and for by-code flows (only those tied to published code_based exams)
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='students' AND policyname='students_public_read') THEN
    EXECUTE 'DROP POLICY students_public_read ON public.students';
  END IF;
  EXECUTE $$CREATE POLICY students_public_read ON public.students
    FOR SELECT TO anon
    USING (
      EXISTS (
        SELECT 1
        FROM public.exam_attempts ea
        JOIN public.exam_results er ON er.attempt_id = ea.id
        JOIN public.exams ex ON ex.id = ea.exam_id
        WHERE ea.student_id = public.students.id AND ex.status = 'published'
      )
      OR EXISTS (
        SELECT 1
        FROM public.student_exam_attempts sea
        JOIN public.exams ex2 ON ex2.id = sea.exam_id
        WHERE sea.student_id = public.students.id AND ex2.status = 'published' AND ex2.access_type = 'code_based'
      )
    )$$;
END $do$;

-- Student exam attempts readable publicly only for published, code-based exams
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='student_exam_attempts' AND policyname='student_exam_attempts_public_read') THEN
    EXECUTE 'DROP POLICY student_exam_attempts_public_read ON public.student_exam_attempts';
  END IF;
  EXECUTE $$CREATE POLICY student_exam_attempts_public_read ON public.student_exam_attempts
    FOR SELECT TO anon
    USING (
      EXISTS (
        SELECT 1 FROM public.exams ex
        WHERE ex.id = public.student_exam_attempts.exam_id
          AND ex.status = 'published'
          AND ex.access_type = 'code_based'
      )
    )$$;
END $do$;

-- Public read of specific system configuration keys only
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='app_config' AND policyname='app_config_public_read_keys') THEN
    EXECUTE 'DROP POLICY app_config_public_read_keys ON public.app_config';
  END IF;
  EXECUTE $$CREATE POLICY app_config_public_read_keys ON public.app_config
    FOR SELECT TO anon
    USING (key IN ('system_mode','system_disabled','system_disabled_message'))$$;
END $do$;

-- Enable RLS for new tables
ALTER TABLE IF EXISTS public.manual_grades ENABLE ROW LEVEL SECURITY;
ALTER TABLE IF EXISTS public.exam_results_history ENABLE ROW LEVEL SECURITY;

-- Admin ALL policies for new tables
DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='manual_grades' AND policyname='manual_grades_admin_all') THEN
    EXECUTE 'DROP POLICY manual_grades_admin_all ON public.manual_grades';
  END IF;
  EXECUTE 'CREATE POLICY manual_grades_admin_all ON public.manual_grades FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

DO $do$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_policies WHERE schemaname='public' AND tablename='exam_results_history' AND policyname='exam_results_history_admin_all') THEN
    EXECUTE 'DROP POLICY exam_results_history_admin_all ON public.exam_results_history';
  END IF;
  EXECUTE 'CREATE POLICY exam_results_history_admin_all ON public.exam_results_history FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
END $do$;

-- Set immutable search_path for all functions in public
DO $do$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT n.nspname, p.proname, oidvectortypes(p.proargtypes) AS args
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prokind = 'f'
  LOOP
    EXECUTE format('ALTER FUNCTION %I.%I(%s) SET search_path TO public, extensions, pg_temp', r.nspname, r.proname, r.args);
  END LOOP;
END $do$;
