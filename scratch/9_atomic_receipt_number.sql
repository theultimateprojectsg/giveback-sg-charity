-- Fixes a race condition in manual-entry receipt numbering (App.jsx: saveManualEntry).
-- Previously the app read the current max "MR-YYYY-######" number, added 1, then inserted —
-- two near-simultaneous manual entries could compute the same next number and collide, relying
-- on a retry loop as a workaround. This migration moves number allocation into the database
-- itself via an atomic upsert, so collisions become structurally impossible rather than just
-- retried after the fact.
-- Run in the Supabase SQL editor.

create table if not exists public.receipt_number_counters (
  charity_uen text not null,
  year int not null,
  last_seq int not null default 0,
  primary key (charity_uen, year)
);

-- Seed the counters from existing data, so numbering continues from the highest
-- receipt number already issued instead of restarting at 1 and colliding with history.
insert into public.receipt_number_counters (charity_uen, year, last_seq)
select
  charity_uen,
  split_part(receipt_number, '-', 2)::int as year,
  max(split_part(receipt_number, '-', 3)::int) as last_seq
from public.donations
where receipt_number like 'MR-%'
  and split_part(receipt_number, '-', 2) ~ '^\d+$'
  and split_part(receipt_number, '-', 3) ~ '^\d+$'
group by charity_uen, split_part(receipt_number, '-', 2)::int
on conflict (charity_uen, year) do update
  set last_seq = greatest(receipt_number_counters.last_seq, excluded.last_seq);

-- Atomically claims and returns the next receipt number for a charity/year.
-- The INSERT ... ON CONFLICT ... RETURNING is a single atomic statement in Postgres,
-- so two concurrent callers can never be handed the same number.
create or replace function public.next_receipt_number(p_charity_uen text, p_year int)
returns text
language plpgsql
security definer
as $$
declare
  v_seq int;
begin
  insert into public.receipt_number_counters (charity_uen, year, last_seq)
  values (p_charity_uen, p_year, 1)
  on conflict (charity_uen, year)
  do update set last_seq = receipt_number_counters.last_seq + 1
  returning last_seq into v_seq;

  return 'MR-' || p_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

grant execute on function public.next_receipt_number(text, int) to authenticated;
