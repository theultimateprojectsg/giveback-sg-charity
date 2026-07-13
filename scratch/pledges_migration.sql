-- ============================================================================
-- Migration: bring the `pledges` table up to parity with `recurring_gifts`
-- and `grants` — programme linking, phone, anonymity, and source channel.
--
-- Run this once against your Supabase project (SQL editor) before using the
-- new Pledges tab fields (Linked Programme, Donor Phone, Anonymous checkbox,
-- "How was this pledge made?").
-- ============================================================================

ALTER TABLE public.pledges
  ADD COLUMN IF NOT EXISTS cause_id uuid REFERENCES public.causes(id),
  ADD COLUMN IF NOT EXISTS donor_phone text,
  ADD COLUMN IF NOT EXISTS is_anonymous boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS source text;
