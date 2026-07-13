-- Adds Singapore-compliance fields to the campaigns (causes) table.
-- Run this in the Supabase SQL editor.

alter table public.causes
  add column if not exists start_date date,
  add column if not exists category text,
  add column if not exists tax_deductible boolean default true,
  add column if not exists benefit_value numeric default 0,
  add column if not exists permit_number text,
  add column if not exists permit_status text default 'not_required',
  add column if not exists permit_expiry date;
