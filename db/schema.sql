-- Core schema for Exam App
-- Safe to run repeatedly due to IF NOT EXISTS

-- Extensions
create extension if not exists pgcrypto;

-- Tables
create table if not exists public.exams (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text null,
  start_time timestamptz null,
  end_time timestamptz null,
  duration_minutes integer null,
  status text not null default 'draft' check (status in ('draft','published','archived')),
  access_type text not null default 'open' check (access_type in ('open','code_based','ip_restricted')),
  settings jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.questions (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  question_text text not null,
  question_type text not null,
  options jsonb null,
  points integer null,
  required boolean not null default false,
  order_index integer null,
  correct_answers jsonb null,
  created_at timestamptz not null default now()
);

-- legacy exam_codes table removed after migration to global students

create table if not exists public.exam_attempts (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  ip_address inet null,
  student_name text null,
  answers jsonb not null default '{}'::jsonb,
  auto_save_data jsonb not null default '{}'::jsonb,
  completion_status text not null default 'in_progress',
  version integer not null default 1,
  started_at timestamptz not null default now(),
  submitted_at timestamptz null,
  updated_at timestamptz not null default now()
);

create table if not exists public.exam_results (
  attempt_id uuid primary key references public.exam_attempts(id) on delete cascade,
  total_questions integer not null default 0,
  correct_count integer not null default 0,
  score_percentage numeric not null default 0,
  calculated_at timestamptz not null default now()
);

create table if not exists public.exam_ips (
  id uuid primary key default gen_random_uuid(),
  exam_id uuid not null references public.exams(id) on delete cascade,
  rule_type text not null check (rule_type in ('whitelist','blacklist')),
  ip_range cidr not null,
  note text null,
  created_at timestamptz not null default now()
);

create table if not exists public.audit_logs (
  id uuid primary key default gen_random_uuid(),
  actor text not null,
  action text not null,
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Lightweight users table to decouple admin management from auth.users
create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  username text unique,
  password_hash text,
  display_name text null,
  created_at timestamptz not null default now()
);

create table if not exists public.admin_users (
  user_id uuid primary key,
  email text null,
  created_at timestamptz not null default now()
);

-- Global students table
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  student_name text null,
  mobile_number text null,
  created_at timestamptz not null default now()
);

-- Per-exam attempt tracking for students
create table if not exists public.student_exam_attempts (
  id uuid primary key default gen_random_uuid(),
  student_id uuid not null references public.students(id) on delete cascade,
  exam_id uuid not null references public.exams(id) on delete cascade,
  attempt_id uuid null references public.exam_attempts(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  status text not null default 'in_progress'
);

-- Ensure exam_attempts has student_id (legacy code_id retained for compat but unused)
do $$ begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'exam_attempts' and column_name = 'student_id'
  ) then
    alter table public.exam_attempts add column student_id uuid null;
  end if;
  if not exists (
    select 1 from pg_constraint c
    join pg_class t on t.oid = c.conrelid
    where t.relname = 'exam_attempts' and c.conname = 'exam_attempts_student_id_fkey'
  ) then
    alter table public.exam_attempts
      add constraint exam_attempts_student_id_fkey foreign key (student_id)
      references public.students(id) on delete set null;
  end if;
end $$;

-- Global summary view
create or replace view public.student_exam_summary as
  select
    s.id as student_id,
    s.code,
    s.student_name,
    s.mobile_number,
    count(sea.id) as total_exams_attempted,
    count(case when sea.status = 'completed' then 1 end) as completed_exams,
    count(case when sea.status = 'in_progress' then 1 end) as in_progress_exams,
    s.created_at as student_created_at
  from public.students s
  left join public.student_exam_attempts sea on sea.student_id = s.id
  group by s.id, s.code, s.student_name, s.mobile_number, s.created_at;

create table if not exists public.app_config (
  key text primary key,
  value text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Seed a default admin user if not present (username: ehab, password: 436762)
do $$
begin
  if not exists (select 1 from public.users where lower(username) = 'ehab') then
    insert into public.users (email, username, password_hash)
    values (null, 'ehab', crypt('436762', gen_salt('bf')));
  end if;

  insert into public.admin_users (user_id, email)
  select u.id, u.email from public.users u where lower(u.username) = 'ehab'
  on conflict (user_id) do nothing;
end $$;

-- Indexes (some duplicated in indexes.sql; IF NOT EXISTS prevents errors)
-- legacy index for exam_codes removed
create index if not exists idx_questions_exam_order on public.questions (exam_id, order_index);
create index if not exists idx_attempts_exam_started on public.exam_attempts (exam_id, started_at desc);
create index if not exists idx_attempts_exam_student_lower on public.exam_attempts (exam_id, lower(student_name));
create index if not exists idx_attempts_submitted_at on public.exam_attempts (submitted_at desc);
create index if not exists idx_results_attempt_id on public.exam_results (attempt_id);
create index if not exists idx_ips_exam_rule on public.exam_ips (exam_id, rule_type);
create index if not exists idx_ips_ip_range on public.exam_ips (ip_range);
-- Insert default system configuration
insert into public.app_config (key, value, description) values
  ('system_disabled', 'false', 'Whether the system is disabled for students'),
  ('system_disabled_message', 'No exams are currently available. Please check back later.', 'Message to show when system is disabled')
on conflict (key) do nothing;