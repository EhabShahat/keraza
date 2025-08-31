-- Create the single-row settings table used by /admin/settings
create table if not exists public.app_settings (
  id uuid primary key default gen_random_uuid(),
  brand_name text,
  brand_logo_url text,
  default_language text,
  whatsapp_default_template text,
  welcome_instructions text,
  welcome_instructions_ar text,
  thank_you_title text,
  thank_you_title_ar text,
  thank_you_message text,
  thank_you_message_ar text,
  enable_name_search boolean,
  enable_code_search boolean,
  updated_at timestamptz default now()
);

-- Add columns safely for existing databases
alter table if exists public.app_settings
  add column if not exists default_language text,
  add column if not exists welcome_instructions_ar text,
  add column if not exists thank_you_title_ar text,
  add column if not exists thank_you_message_ar text,
  add column if not exists enable_name_search boolean,
  add column if not exists enable_code_search boolean;

-- Create key-value settings table for system configuration
create table if not exists public.app_config (
  key text primary key,
  value text not null,
  description text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Insert default system configuration
insert into public.app_config (key, value, description) values
  ('system_disabled', 'false', 'Whether the system is disabled for students'),
  ('system_disabled_message', 'No exams are currently available. Please check back later.', 'Message to show when system is disabled')
on conflict (key) do nothing;

-- Ensure only one row is used by convention (app enforces update of first row)
-- Optionally enforce single row via a check constraint (Postgres 16+ can use nulls not distinct)
-- alter table public.app_settings add constraint one_row check ((select count(*) from public.app_settings) <= 1);
