-- RPC functions for Exam App
-- This file defines all RPCs required by the app.
-- Safe to run multiple times due to CREATE OR REPLACE.

-- Ensure pgcrypto for gen_random_uuid/gen_random_bytes
create extension if not exists pgcrypto;

-- Ensure exam_attempts has device_info column (idempotent)
alter table if exists public.exam_attempts add column if not exists device_info jsonb;

-- Attempt activity events table (idempotent)
create table if not exists public.attempt_activity_events (
  id uuid primary key default gen_random_uuid(),
  attempt_id uuid not null references public.exam_attempts(id) on delete cascade,
  event_type text not null,
  event_time timestamptz not null default now(),
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Helpful indexes for querying
create index if not exists idx_activity_attempt_time on public.attempt_activity_events (attempt_id, event_time desc);
create index if not exists idx_activity_event_type on public.attempt_activity_events (event_type);

-- Batch log attempt activity events
CREATE OR REPLACE FUNCTION public.log_attempt_activity(p_attempt_id uuid, p_events jsonb)
RETURNS TABLE(inserted_count integer)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_count integer := 0;
BEGIN
  IF p_attempt_id IS NULL THEN
    RAISE EXCEPTION 'invalid_attempt_id';
  END IF;

  INSERT INTO public.attempt_activity_events (attempt_id, event_type, event_time, payload)
  SELECT
    p_attempt_id,
    left(coalesce(e->>'event_type', 'unknown'), 64),
    COALESCE((e->>'event_time')::timestamptz, now()),
    COALESCE(e->'payload', '{}'::jsonb)
  FROM jsonb_array_elements(COALESCE(p_events, '[]'::jsonb)) AS e;
  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.log_attempt_activity(uuid, jsonb) TO service_role;

-- Execute arbitrary SQL passed from the server (service role only)
-- Splits by semicolons and executes each non-empty, non-comment statement.
CREATE OR REPLACE FUNCTION public.exec_sql(sql text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  stmt text;
BEGIN
  FOREACH stmt IN ARRAY regexp_split_to_array(sql, ';')
  LOOP
    stmt := trim(stmt);
    IF stmt IS NULL OR stmt = '' OR left(stmt, 2) = '--' THEN
      CONTINUE;
    END IF;
    EXECUTE stmt;
  END LOOP;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.exec_sql(text) TO service_role;

-- get_attempt_state(uuid) -> jsonb
CREATE OR REPLACE FUNCTION public.get_attempt_state(p_attempt_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_row public.exam_attempts%rowtype;
  v_exam public.exams%rowtype;
  v_json jsonb;
BEGIN
  select * into v_row from public.exam_attempts where id=p_attempt_id;
  if not found then raise exception 'attempt_not_found'; end if;
  select * into v_exam from public.exams where id=v_row.exam_id;

  v_json := jsonb_build_object(
    'attemptId', v_row.id,
    'version', v_row.version,
    'started_at', v_row.started_at,
    'exam', jsonb_build_object(
      'id', v_exam.id,
      'title', v_exam.title,
      'description', v_exam.description,
      'start_time', v_exam.start_time,
      'end_time', v_exam.end_time,
      'duration_minutes', v_exam.duration_minutes,
      'settings', v_exam.settings,
      'access_type', v_exam.access_type
    ),
    'auto_save_data', v_row.auto_save_data,
    'answers', v_row.answers,
    'completion_status', v_row.completion_status,
    'submitted_at', v_row.submitted_at
  );

  v_json := v_json || jsonb_build_object(
    'questions', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', q.id,
        'question_text', q.question_text,
        'question_type', q.question_type,
        'options', q.options,
        'points', q.points,
        'required', q.required,
        'order_index', q.order_index
      ) order by q.order_index nulls last, q.created_at), '[]'::jsonb)
      from public.questions q where q.exam_id = v_row.exam_id
    )
  );

  return v_json;
END;
$function$;

-- save_attempt(uuid,jsonb,jsonb,int) -> table(new_version int)
CREATE OR REPLACE FUNCTION public.save_attempt(p_attempt_id uuid, p_answers jsonb, p_auto_save_data jsonb, p_expected_version integer)
 RETURNS TABLE(new_version integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_row public.exam_attempts%rowtype;
BEGIN
  select * into v_row from public.exam_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if v_row.submitted_at is not null or v_row.completion_status='submitted' then raise exception 'attempt_already_submitted'; end if;
  if v_row.version <> p_expected_version then raise exception 'version_mismatch'; end if;

  update public.exam_attempts
  set answers = coalesce(p_answers, '{}'::jsonb),
      auto_save_data = coalesce(p_auto_save_data, '{}'::jsonb),
      version = v_row.version + 1,
      updated_at = now()
  where id = p_attempt_id;

  return query select v_row.version + 1;
END;
$function$;

-- start_attempt(uuid,text,text,inet) -> table(attempt_id uuid, seed text)
CREATE OR REPLACE FUNCTION public.start_attempt(p_exam_id uuid, p_code text, p_student_name text, p_ip inet)
 RETURNS TABLE(attempt_id uuid, seed text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_exam public.exams%rowtype;
  v_student public.students%rowtype;
  v_attempt_id uuid;
  v_seed text;
  v_attempt_limit int;
  v_clean_name text;
  v_clean_norm text;
BEGIN
  select * into v_exam from public.exams e where e.id = p_exam_id;
  if not found then
    raise exception 'exam_not_found';
  end if;

  if v_exam.status <> 'published' then
    raise exception 'exam_not_published';
  end if;

  if v_exam.start_time is not null and now() < v_exam.start_time then
    raise exception 'exam_not_started';
  end if;
  if v_exam.end_time is not null and now() > v_exam.end_time then
    raise exception 'exam_ended';
  end if;

  v_attempt_limit := coalesce((v_exam.settings->>'attempt_limit')::int, 1);

  if v_exam.access_type = 'code_based' then
    if p_code is null then
      raise exception 'code_required';
    end if;
    select * into v_student from public.students s where s.code = p_code;
    if not found then
      raise exception 'invalid_code';
    end if;
    -- Lock on (exam_id, student_id) to avoid race conditions starting multiple attempts
    PERFORM pg_advisory_xact_lock(hashtext(p_exam_id::text), hashtext(v_student.id::text));
    -- Ensure no prior attempt exists for this student in this exam
    if exists (
      select 1 from public.student_exam_attempts sea
      where sea.exam_id = p_exam_id and sea.student_id = v_student.id
    ) then
      raise exception 'code_already_used';
    end if;
  end if;

  -- Prepare student name for ip/open modes (kept for storage/UX)
  if v_exam.access_type = 'ip_restricted' then
    v_clean_name := nullif(btrim(p_student_name), '');
    if v_clean_name is null then
      raise exception 'student_name_required';
    end if;
  elsif v_exam.access_type = 'open' then
    v_clean_name := nullif(btrim(p_student_name), '');
  end if;

  -- Attempt limiting
  -- code_based: no IP-based limiting (each code limited via student_exam_attempts)
  -- ip_restricted/open: enforce per-IP-per-exam using attempt_limit from settings
  if v_attempt_limit > 0 then
    if v_exam.access_type in ('ip_restricted','open') then
      -- Lock on (exam_id, ip) to avoid races
      PERFORM pg_advisory_xact_lock(hashtext(p_exam_id::text), hashtext(host(p_ip)));
      if (
        select count(*) 
        from public.exam_attempts a 
        where a.exam_id = p_exam_id and a.ip_address = p_ip
      ) >= v_attempt_limit then
        raise exception 'attempt_limit_reached';
      end if;
    end if;
  end if;

  -- IP rules
  if exists (select 1 from public.exam_ips ip where ip.exam_id = p_exam_id and ip.rule_type='whitelist') then
    if not exists (select 1 from public.exam_ips ip where ip.exam_id = p_exam_id and ip.rule_type='whitelist' and p_ip << ip.ip_range) then
      raise exception 'ip_not_whitelisted';
    end if;
  end if;
  if exists (select 1 from public.exam_ips ip where ip.exam_id = p_exam_id and ip.rule_type='blacklist' and p_ip << ip.ip_range) then
    raise exception 'ip_blacklisted';
  end if;

  v_seed := encode(gen_random_bytes(16), 'hex');
  v_attempt_id := gen_random_uuid();

  insert into public.exam_attempts(id, exam_id, student_id, ip_address, student_name, answers, auto_save_data, completion_status, version)
  values(
    v_attempt_id,
    p_exam_id,
    case when v_exam.access_type='code_based' then v_student.id else null end,
    p_ip,
    case when v_exam.access_type in ('ip_restricted','open') then v_clean_name else null end,
    '{}'::jsonb,
    jsonb_build_object('seed', v_seed, 'progress', jsonb_build_object('answered',0,'total',0)),
    'in_progress',
    1
  );

  if v_exam.access_type='code_based' then
    insert into public.student_exam_attempts(student_id, exam_id, attempt_id, status)
    values (v_student.id, p_exam_id, v_attempt_id, 'in_progress');
  end if;

  return query select v_attempt_id, v_seed;
END;
$function$;

-- Compatibility wrapper: start_attempt_v2 delegates to start_attempt
-- Ensures API calling start_attempt_v2 uses the same per-exam attempt limiting and IP rules
CREATE OR REPLACE FUNCTION public.start_attempt_v2(p_exam_id uuid, p_code text, p_student_name text, p_ip inet)
 RETURNS TABLE(attempt_id uuid, seed text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
BEGIN
  -- Delegate to the primary implementation
  RETURN QUERY SELECT * FROM public.start_attempt(p_exam_id, p_code, p_student_name, p_ip);
END;
$function$;

-- submit_attempt(uuid) -> table(total_questions int, correct_count int, score_percentage numeric)
CREATE OR REPLACE FUNCTION public.submit_attempt(p_attempt_id uuid)
 RETURNS TABLE(total_questions integer, correct_count integer, score_percentage numeric)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_row public.exam_attempts%rowtype;
  v_total int;
  v_correct int;
  v_score numeric;
BEGIN
  select * into v_row from public.exam_attempts where id=p_attempt_id for update;
  if not found then raise exception 'attempt_not_found'; end if;
  if v_row.submitted_at is not null or v_row.completion_status='submitted' then raise exception 'attempt_already_submitted'; end if;

  with ans as (
    select q.id,
           q.question_type,
           q.correct_answers,
           (v_row.answers -> (q.id::text)) as student_json
    from public.questions q
    where q.exam_id = v_row.exam_id
  ),
  norm as (
    select a.id,
           a.question_type,
           a.correct_answers,
           a.student_json,
           case when a.question_type in ('multiple_choice','multi_select') then
             coalesce((select array(select jsonb_array_elements_text(a.student_json) order by 1)), array[]::text[])
           else null end as s_arr,
           case when a.question_type in ('multiple_choice','multi_select') then
             coalesce((select array(select jsonb_array_elements_text(a.correct_answers) order by 1)), array[]::text[])
           else null end as c_arr
    from ans a
  ),
  graded as (
    select n.id,
           n.question_type,
           case
             when n.question_type = 'paragraph' then null
             when n.question_type in ('true_false','single_choice') then
               case
                 when n.student_json is null then false
                 when jsonb_typeof(n.correct_answers) = 'array' and jsonb_array_length(n.correct_answers)=1 then
                   (n.student_json::text = (n.correct_answers->0)::text)
                 else n.student_json::text = n.correct_answers::text
               end
             when n.question_type in ('multiple_choice','multi_select') then
               coalesce(n.s_arr, array[]::text[]) = coalesce(n.c_arr, array[]::text[])
             else false
           end as is_correct
    from norm n
  )
  select count(*) filter (where question_type <> 'paragraph') as total_q,
         count(*) filter (where is_correct is true) as correct_cnt
  into v_total, v_correct
  from graded;

  v_score := case when v_total > 0 then round((v_correct::numeric * 100.0) / v_total, 2) else 0 end;

  insert into public.exam_results(attempt_id, total_questions, correct_count, score_percentage)
  values (p_attempt_id, v_total, v_correct, v_score)
  on conflict (attempt_id) do update set total_questions=excluded.total_questions, correct_count=excluded.correct_count, score_percentage=excluded.score_percentage, calculated_at=now();

  update public.exam_attempts
    set submitted_at = now(), completion_status='submitted', updated_at=now()
  where id = p_attempt_id;

  return query select v_total, v_correct, v_score;
END;
$function$;

-- cleanup_expired_attempts() -> auto-submit expired in-progress attempts
CREATE OR REPLACE FUNCTION public.cleanup_expired_attempts()
 RETURNS TABLE(auto_submitted_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_id uuid;
  v_count integer := 0;
BEGIN
  -- Iterate over all attempts that have expired by duration or exam end_time
  FOR v_id IN
    SELECT a.id
    FROM public.exam_attempts a
    JOIN public.exams e ON e.id = a.exam_id
    WHERE a.submitted_at IS NULL
      AND a.completion_status = 'in_progress'
      AND (
        (e.duration_minutes IS NOT NULL AND now() >= a.started_at + make_interval(mins => e.duration_minutes))
        OR (e.end_time IS NOT NULL AND now() >= e.end_time)
      )
  LOOP
    BEGIN
      -- Use existing grading + submission logic
      PERFORM * FROM public.submit_attempt(v_id);
      v_count := v_count + 1;

      -- Update per-exam tracking if present
      UPDATE public.student_exam_attempts
        SET completed_at = now(), status = 'completed'
        WHERE attempt_id = v_id AND completed_at IS NULL;
    EXCEPTION WHEN others THEN
      -- Ignore races (e.g., attempt already submitted) and continue
      CONTINUE;
    END;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$function$;

-- admin_list_attempts(uuid) -> attempts list for Admin UI
CREATE OR REPLACE FUNCTION public.admin_list_attempts(p_exam_id uuid)
RETURNS TABLE (
  id uuid,
  exam_id uuid,
  started_at timestamptz,
  submitted_at timestamptz,
  completion_status text,
  ip_address inet,
  student_name text,
  score_percentage numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
  SELECT a.id,
         a.exam_id,
         a.started_at,
         a.submitted_at,
         a.completion_status,
         a.ip_address,
         coalesce(s.student_name, a.student_name) as student_name,
         er.score_percentage
  FROM public.exam_attempts a
  LEFT JOIN public.students s ON s.id = a.student_id
  LEFT JOIN public.exam_results er ON er.attempt_id = a.id
  WHERE a.exam_id = p_exam_id
  ORDER BY a.started_at desc nulls first;
END;
$function$;

-- Grants (RPCs are called by anon or service role depending on server config)
grant execute on function public.get_attempt_state(uuid) to anon, authenticated;
grant execute on function public.save_attempt(uuid, jsonb, jsonb, integer) to anon, authenticated;
grant execute on function public.start_attempt(uuid, text, text, inet) to anon, authenticated;
grant execute on function public.start_attempt_v2(uuid, text, text, inet) to anon, authenticated;
grant execute on function public.submit_attempt(uuid) to anon, authenticated;
grant execute on function public.admin_list_attempts(uuid) to service_role;
grant execute on function public.cleanup_expired_attempts() to service_role;

-- Admin management RPCs
-- Reset a student's attempts (admin only). This deletes rows from student_exam_attempts
-- so the student can retake exams. Historical exam_attempts and exam_results remain.
CREATE OR REPLACE FUNCTION public.admin_reset_student_attempts(p_student_id uuid, p_exam_id uuid DEFAULT NULL)
 RETURNS TABLE(deleted_count integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_deleted integer := 0;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  IF p_student_id IS NULL THEN
    RAISE EXCEPTION 'invalid_student_id';
  END IF;

  IF p_exam_id IS NULL THEN
    DELETE FROM public.student_exam_attempts
    WHERE student_id = p_student_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  ELSE
    DELETE FROM public.student_exam_attempts
    WHERE student_id = p_student_id AND exam_id = p_exam_id;
    GET DIAGNOSTICS v_deleted = ROW_COUNT;
  END IF;

  RETURN QUERY SELECT v_deleted;
END;
$function$;

grant execute on function public.admin_reset_student_attempts(uuid, uuid) to service_role;
grant execute on function public.admin_reset_student_attempts(uuid, uuid) to anon, authenticated;

-- List admins (requires caller to be admin)
CREATE OR REPLACE FUNCTION public.admin_list_admins()
 RETURNS TABLE(user_id uuid, username text, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  RETURN QUERY
    SELECT au.user_id, u.username, au.email
    FROM public.admin_users au
    LEFT JOIN public.users u ON u.id = au.user_id
    ORDER BY coalesce(u.username, '') ASC, au.email NULLS LAST, au.user_id;
END;
$function$;

-- Add admin by email (requires caller to be admin). Finds the user in auth.users by email.
CREATE OR REPLACE FUNCTION public.admin_add_admin_by_email(p_email text)
 RETURNS TABLE(user_id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  -- Find or create a user by email in public.users
  SELECT u.id INTO v_uid
  FROM public.users u
  WHERE lower(u.email) = v_email
  LIMIT 1;

  IF v_uid IS NULL THEN
    INSERT INTO public.users(email) VALUES (v_email)
    ON CONFLICT (email) DO NOTHING;
    SELECT u.id INTO v_uid FROM public.users u WHERE lower(u.email) = v_email LIMIT 1;
  END IF;

  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'user_create_failed';
  END IF;

  INSERT INTO public.admin_users (user_id, email)
  VALUES (v_uid, v_email)
  ON CONFLICT ON CONSTRAINT admin_users_pkey DO UPDATE SET email = EXCLUDED.email;

  RETURN QUERY SELECT v_uid, v_email;
END;
$function$;

-- Update an admin's email (requires caller to be admin)
CREATE OR REPLACE FUNCTION public.admin_update_admin_email(p_user_id uuid, p_email text)
 RETURNS TABLE(user_id uuid, email text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_email text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_email := lower(trim(p_email));
  IF v_email IS NULL OR v_email = '' THEN
    RAISE EXCEPTION 'invalid_email';
  END IF;

  UPDATE public.admin_users SET email = v_email WHERE user_id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'admin_not_found';
  END IF;

  -- Ensure a users row exists with this email (no-op if exists)
  INSERT INTO public.users (email)
  VALUES (v_email)
  ON CONFLICT (email) DO NOTHING;

  RETURN QUERY SELECT p_user_id, v_email;
END;
$function$;

-- Remove admin by user_id (requires caller to be admin)
CREATE OR REPLACE FUNCTION public.admin_remove_admin(p_user_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  -- Prevent removing the last remaining admin
  IF (SELECT count(*) FROM public.admin_users) <= 1 THEN
    RAISE EXCEPTION 'cannot_remove_last_admin';
  END IF;

  DELETE FROM public.admin_users WHERE user_id = p_user_id;
END;
$function$;

-- Grants for admin management RPCs
grant execute on function public.admin_list_admins() to service_role;
grant execute on function public.admin_add_admin_by_email(text) to service_role;
grant execute on function public.admin_update_admin_email(uuid, text) to service_role;
grant execute on function public.admin_remove_admin(uuid) to service_role;

-- Custom auth: login against public.users (username or email) using pgcrypto's crypt
CREATE OR REPLACE FUNCTION public.auth_login(p_identifier text, p_password text)
 RETURNS TABLE(user_id uuid, email text, username text, is_admin boolean)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO public, extensions
AS $function$
DECLARE
  v_user public.users%ROWTYPE;
BEGIN
  SELECT * INTO v_user
  FROM public.users u
  WHERE (u.email IS NOT NULL AND lower(u.email) = lower(p_identifier))
     OR (u.username IS NOT NULL AND lower(u.username) = lower(p_identifier))
  LIMIT 1;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  IF v_user.password_hash IS NULL OR v_user.password_hash = '' OR v_user.password_hash <> crypt(p_password, v_user.password_hash) THEN
    RAISE EXCEPTION 'invalid_credentials';
  END IF;

  RETURN QUERY
  SELECT v_user.id, v_user.email, v_user.username,
         EXISTS(SELECT 1 FROM public.admin_users au WHERE au.user_id = v_user.id);
END;
$function$;

grant execute on function public.auth_login(text, text) to service_role;

-- Create users with hashed passwords (admin only)
CREATE OR REPLACE FUNCTION public.admin_create_user(
  p_username text,
  p_email text,
  p_password text,
  p_is_admin boolean DEFAULT false
)
RETURNS TABLE(user_id uuid, username text, email text, is_admin boolean)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
DECLARE
  v_uid uuid;
  v_username text;
  v_email text;
  v_hash text;
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;

  v_username := nullif(trim(p_username), '');
  v_email := nullif(lower(trim(p_email)), '');

  IF v_username IS NULL AND v_email IS NULL THEN
    RAISE EXCEPTION 'missing_identifier';
  END IF;

  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'weak_password';
  END IF;

  -- enforce uniqueness manually to provide clearer errors
  IF v_username IS NOT NULL AND EXISTS(SELECT 1 FROM public.users u WHERE lower(u.username) = lower(v_username)) THEN
    RAISE EXCEPTION 'duplicate_username';
  END IF;
  IF v_email IS NOT NULL AND EXISTS(SELECT 1 FROM public.users u WHERE lower(u.email) = v_email) THEN
    RAISE EXCEPTION 'duplicate_email';
  END IF;

  v_hash := crypt(p_password, gen_salt('bf'));

  INSERT INTO public.users (username, email, password_hash)
  VALUES (v_username, v_email, v_hash)
  RETURNING id INTO v_uid;

  IF p_is_admin THEN
    INSERT INTO public.admin_users (user_id, email)
    VALUES (v_uid, v_email)
    ON CONFLICT ON CONSTRAINT admin_users_pkey DO UPDATE SET email = EXCLUDED.email;
  END IF;

  RETURN QUERY SELECT v_uid, v_username, v_email, p_is_admin;
END;
$function$;

-- Update a user's password (admin only)
CREATE OR REPLACE FUNCTION public.admin_set_user_password(p_user_id uuid, p_password text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO public, extensions
AS $function$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'forbidden';
  END IF;
  IF p_password IS NULL OR length(p_password) < 8 THEN
    RAISE EXCEPTION 'weak_password';
  END IF;
  UPDATE public.users
    SET password_hash = crypt(p_password, gen_salt('bf'))
    WHERE id = p_user_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'user_not_found';
  END IF;
END;
$function$;

-- Grants
grant execute on function public.admin_create_user(text, text, text, boolean) to service_role;
grant execute on function public.admin_set_user_password(uuid, text) to service_role;
