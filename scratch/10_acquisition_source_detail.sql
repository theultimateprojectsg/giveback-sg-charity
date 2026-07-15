-- Adds a free-text detail field alongside "How did they find you?" on manual donation entry,
-- so every acquisition source (Event, Social Media, Corporate Partner, etc.) can be refined
-- with specifics, not just "Referral" via the existing donor picker.
-- Run in the Supabase SQL editor.

alter table public.donations
  add column if not exists acquisition_source_detail text;
