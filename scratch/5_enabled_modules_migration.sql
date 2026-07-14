-- Adds a per-charity feature-toggle column so charities can hide unused modules
-- (Campaigns, Mass Appeals, Pledges, Recurring, Grants) from the nav, Dashboard, and Analytics.
-- Run in the Supabase SQL editor.

alter table public.charity_contacts
  add column if not exists enabled_modules jsonb default '{"campaigns": true, "massappeal": true, "pledges": true, "recurring": true, "grants": true}'::jsonb;
