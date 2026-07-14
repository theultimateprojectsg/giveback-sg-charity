-- Splits the "major gift" concept (single donation size) from "major donor" (lifetime
-- giving) into two separate, per-charity adjustable thresholds. Previously both used the
-- same hardcoded $200 constant, which is why "major donor" checks (like the visit-reminder
-- feature) were flagging 150+ donors off a $200 lifetime-total bar.
-- Run in the Supabase SQL editor.

alter table public.charity_contacts
  add column if not exists major_gift_threshold numeric default 200,
  add column if not exists major_donor_threshold numeric default 1000;
