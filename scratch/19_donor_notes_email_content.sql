-- Lets the Communication Log keep the actual email that was sent (subject + body), so a logged
-- "… sent by email" entry can be clicked open to see exactly what went out. Notes without an email
-- (calls, manual logs) simply leave these null.
-- Run in the Supabase SQL editor (the connected MCP server is read-only, can't apply this directly).

alter table public.donor_notes
  add column if not exists email_subject text,
  add column if not exists email_body text;
