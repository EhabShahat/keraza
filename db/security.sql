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
  EXECUTE 'CREATE POLICY app_settings_admin_write ON public.app_settings FOR ALL USING (public.is_admin()) WITH CHECK (public.is_admin())';
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
