-- Makes the "cumulative giving milestone" thresholds ($1,000 / $5,000 / $10,000 by default)
-- adjustable per charity, matching the other configurable thresholds (lapsed donors, giving
-- change, major gift/donor).
-- Run in the Supabase SQL editor.

alter table public.charity_contacts
  add column if not exists cumulative_milestone_thresholds jsonb default '[1000, 5000, 10000]'::jsonb;
