-- Adds 'refunded' as an allowed payment_status, so recording a refund (App.jsx: saveRefund) can
-- set donations.payment_status = 'refunded'. This is what pulls a refunded donation out of every
-- total/analytics/IRAS-export calculation in the app, since they all filter on
-- payment_status === 'confirmed' — refunded donations stay visible in the Donations list (not
-- deleted) but no longer count as real, completed giving.
--
-- If payment_status has a CHECK constraint restricting it to the existing values (e.g. 'pending',
-- 'confirmed'), the update in saveRefund will fail with a constraint violation the same way
-- recurring_gift_events did for 'failed_deduction' (see 4_fix_failed_deduction_constraint.sql).
-- This drops and recreates that constraint, if one exists, to also allow 'refunded'.
-- Run in the Supabase SQL editor.

do $$
declare
  con_name text;
begin
  select conname into con_name
  from pg_constraint
  where conrelid = 'public.donations'::regclass
    and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%payment_status%';

  if con_name is not null then
    execute format('alter table public.donations drop constraint %I', con_name);
  end if;
end $$;

alter table public.donations
  add constraint donations_payment_status_check
  check (payment_status = any (array['pending'::text, 'confirmed'::text, 'refunded'::text]));
