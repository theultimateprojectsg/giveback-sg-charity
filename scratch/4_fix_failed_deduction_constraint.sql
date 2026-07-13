-- Fixes a broken feature: the app records recurring-gift failed-deduction events with
-- event_type = 'failed_deduction' (see App.jsx: recordFailedDeduction, confirmRecordFailedDeduction,
-- undoFailedDeduction, loadRecurringGifts), but the table's CHECK constraint only allows
-- 'skip' and 'reminder'. Every click of "Failed Deduction" in the Recurring Gifts tab
-- currently fails with a DB constraint violation.
-- Run in the Supabase SQL editor.

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.recurring_gift_events'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%event_type%';

  if con_name is not null then
    execute format('alter table public.recurring_gift_events drop constraint %I', con_name);
  end if;
end $$;

alter table public.recurring_gift_events
  add constraint recurring_gift_events_event_type_check
  check (event_type = any (array['skip'::text, 'reminder'::text, 'failed_deduction'::text]));
