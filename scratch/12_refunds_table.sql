-- Creates the refunds table used by App.jsx's saveRefund/loadRefunds/deleteRefund.
-- If "Record Refund" is erroring in the app, this table (or its RLS policies) most likely
-- never existed in this Supabase project — there was no prior migration file for it.
-- Run in the Supabase SQL editor.

create table if not exists public.refunds (
  id uuid primary key default gen_random_uuid(),
  donation_id uuid not null references public.donations(id) on delete cascade,
  charity_uen text not null,
  original_amount numeric not null,
  refund_amount numeric not null,
  refund_date date not null,
  reason text not null,
  approved_by text,
  created_at timestamptz not null default now()
);

create index if not exists refunds_donation_id_idx on public.refunds(donation_id);
create index if not exists refunds_charity_uen_idx on public.refunds(charity_uen);

alter table public.refunds enable row level security;

drop policy if exists "Charity can view own refunds" on public.refunds;
create policy "Charity can view own refunds"
on public.refunds for select
to authenticated
using (charity_uen = (auth.jwt() -> 'user_metadata' ->> 'charity_uen'));

drop policy if exists "Charity can insert own refunds" on public.refunds;
create policy "Charity can insert own refunds"
on public.refunds for insert
to authenticated
with check (charity_uen = (auth.jwt() -> 'user_metadata' ->> 'charity_uen'));

drop policy if exists "Charity can delete own refunds" on public.refunds;
create policy "Charity can delete own refunds"
on public.refunds for delete
to authenticated
using (charity_uen = (auth.jwt() -> 'user_metadata' ->> 'charity_uen'));
