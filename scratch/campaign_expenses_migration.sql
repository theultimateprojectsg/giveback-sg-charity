-- Adds an itemized expense ledger for campaigns (causes), mirroring grant_expenses.
-- Run this in the Supabase SQL editor.

create table if not exists public.campaign_expenses (
  id uuid not null default gen_random_uuid(),
  cause_id uuid not null,
  description text not null,
  amount numeric not null,
  expense_date date not null,
  category text,
  created_at timestamp with time zone default now(),
  created_by text,
  constraint campaign_expenses_pkey primary key (id),
  constraint campaign_expenses_cause_id_fkey foreign key (cause_id) references public.causes(id)
);
