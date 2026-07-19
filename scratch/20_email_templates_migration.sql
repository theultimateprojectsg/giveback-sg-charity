-- Run in the Supabase SQL editor.
alter table public.charity_contacts add column if not exists email_templates jsonb default '{}'::jsonb;
