-- Backfills created_by for existing donations that were created without it — specifically the
-- recurring-gift "Mark Received" and pledge-fulfillment flows (App.jsx: confirmMarkReceived,
-- the pledge fulfillment branch), which inserted source: 'manual' rows but never set created_by.
--
-- This is needed if your RLS policy / trigger on donations UPDATE checks created_by IS NOT NULL
-- (not just source = 'manual') to decide "is this a real manually-entered donation" — which would
-- explain the "only manually entered donations can have these fields edited" error when trying to
-- correct the amount on an existing recurring-gift payment via the new inline edit in the Recurring
-- Gifts tab.
--
-- Replace 'YOUR_EMAIL_HERE' below with the email of whoever should be recorded as having entered
-- these — e.g. your own ED/staff login email. The WHERE clause targets rows with source = 'manual'
-- and created_by IS NULL that are tied to a recurring gift or a pledge fulfillment, which should
-- only match rows from these two flows — review it before running.
-- Run in the Supabase SQL editor.

update public.donations
set created_by = 'YOUR_EMAIL_HERE'
where source = 'manual'
  and created_by is null
  and (recurring_gift_id is not null or notes ilike '%pledge fulfillment%');
