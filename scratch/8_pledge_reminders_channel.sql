-- Lets the ED log an offline follow-up (phone call, in-person, other) on a pledge
-- instead of being forced to send an email reminder just to stop the Dashboard's
-- "needs a reminder" nag. Reuses the existing pledge_reminders table/timing logic —
-- a manual "channel" entry counts the same as an email for the 7-day suppression window.
-- Run in the Supabase SQL editor.

alter table public.pledge_reminders
  add column if not exists channel text not null default 'email';

alter table public.pledge_reminders
  add constraint pledge_reminders_channel_check
  check (channel = any (array['email'::text, 'phone'::text, 'in_person'::text, 'other'::text]));

alter table public.pledge_reminders
  alter column subject drop not null;
