-- Adds RLS policies for campaign_expenses, scoped by the parent campaign's charity_uen
-- (matches the charity_uen stored in the logged-in user's auth JWT user_metadata).
-- Run in the Supabase SQL editor.

alter table public.campaign_expenses enable row level security;

create policy "Charity can view own campaign expenses"
on public.campaign_expenses for select
to authenticated
using (
  exists (
    select 1 from public.causes
    where causes.id = campaign_expenses.cause_id
      and causes.charity_uen = (auth.jwt() -> 'user_metadata' ->> 'charity_uen')
  )
);

create policy "Charity can insert own campaign expenses"
on public.campaign_expenses for insert
to authenticated
with check (
  exists (
    select 1 from public.causes
    where causes.id = campaign_expenses.cause_id
      and causes.charity_uen = (auth.jwt() -> 'user_metadata' ->> 'charity_uen')
  )
);

create policy "Charity can delete own campaign expenses"
on public.campaign_expenses for delete
to authenticated
using (
  exists (
    select 1 from public.causes
    where causes.id = campaign_expenses.cause_id
      and causes.charity_uen = (auth.jwt() -> 'user_metadata' ->> 'charity_uen')
  )
);
