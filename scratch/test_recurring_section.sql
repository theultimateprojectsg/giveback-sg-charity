-- ============================================================================
-- Test data for the "Recurring Donations Performance" analytics section
-- (Recurring Snapshot tiles, MRR/Retention/Reliability/Lifespan/At-risk tiles,
-- Recurring Revenue Trend, Revenue Composition, New vs Churned MRR,
-- Giving Trend, Authorization & Mandate Risk, Recurring Gift Risk)
--
-- Assumes a single charity in charity_contacts (your test tenant). If you have
-- more than one row there, replace the subquery
--   (SELECT charity_uen FROM charity_contacts LIMIT 1)
-- with your actual charity_uen literal everywhere below.
--
-- Dates are anchored around 2026-07-13 ("today"). Adjust if you're running
-- this well after that date — the "at risk", "ending soon", and "new gift"
-- scenarios depend on being close to today.
--
-- Safe to re-run: delete block at the bottom removes everything by donor_key
-- prefix 'sqltest-' so you can reset and reseed.
-- ============================================================================

-- ---------- 0. Cleanup (safe to run first if re-seeding) ----------
DELETE FROM public.recurring_gift_events WHERE recurring_gift_id IN (
  SELECT id FROM public.recurring_gifts WHERE donor_key LIKE 'sqltest-%'
);
DELETE FROM public.donations WHERE recurring_gift_id IN (
  SELECT id FROM public.recurring_gifts WHERE donor_key LIKE 'sqltest-%'
);
DELETE FROM public.recurring_gifts WHERE donor_key LIKE 'sqltest-%';

-- ---------- 1. Recurring gifts ----------
INSERT INTO public.recurring_gifts
  (id, charity_uen, donor_name, donor_email, donor_key, amount, frequency,
   start_date, next_expected_date, type, status, created_at, created_by,
   cancelled_at, bank_name, authorization_status, end_date)
VALUES
  -- 1. Steady GIRO donor, on-time, will get an "upgrade" trend flag from donations below
  ('11111111-1111-1111-1111-111111111101', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Tan Wei Ling', 'tanweiling@example.com', 'sqltest-tanweiling@example.com', 150, 'monthly',
   '2024-03-10', '2026-07-10', 'giro', 'active', '2024-03-10', 'sqltest',
   NULL, 'DBS', 'active', NULL),

  -- 2. Steady GIRO donor, will get a "downgrade" trend flag from donations below
  ('11111111-1111-1111-1111-111111111102', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Muhammad Farid', 'mfarid@example.com', 'sqltest-mfarid@example.com', 150, 'monthly',
   '2023-01-15', '2026-07-08', 'giro', 'active', '2023-01-15', 'sqltest',
   NULL, 'DBS', 'active', NULL),

  -- 3. AT RISK: next_expected_date far in the past, no recent payments -> missed cycles
  ('11111111-1111-1111-1111-111111111103', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Sarah Lim', 'sarahlim@example.com', 'sqltest-sarahlim@example.com', 90, 'monthly',
   '2024-02-01', '2026-05-01', 'giro', 'active', '2024-02-01', 'sqltest',
   NULL, 'OCBC', 'active', NULL),

  -- 4. Steady habitual PayNow donor, active >1yr ago and now -> feeds retention rate
  ('11111111-1111-1111-1111-111111111104', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Jonathan Koh', 'jkoh@example.com', 'sqltest-jkoh@example.com', 120, 'monthly',
   '2025-01-01', '2026-07-01', 'habitual_paynow', 'active', '2025-01-01', 'sqltest',
   NULL, NULL, NULL, NULL),

  -- 5. Annual GIRO donor, not due yet -> feeds reliability calc
  ('11111111-1111-1111-1111-111111111105', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Grace Ng', 'graceng@example.com', 'sqltest-graceng@example.com', 1200, 'annually',
   '2020-08-01', '2026-08-01', 'giro', 'active', '2020-08-01', 'sqltest',
   NULL, 'DBS', 'active', NULL),

  -- 6. NEW gift started within the last 90 days -> feeds "new gift" / MRR delta
  ('11111111-1111-1111-1111-111111111106', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Priya Nathan', 'priyan@example.com', 'sqltest-priyan@example.com', 80, 'monthly',
   '2026-06-20', '2026-07-20', 'habitual_paynow', 'active', '2026-06-20', 'sqltest',
   NULL, NULL, NULL, NULL),

  -- 7. CANCELLED (short lifespan ~6 months) -> feeds avg lifespan
  ('11111111-1111-1111-1111-111111111107', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Alvin Teo', 'alvinteo@example.com', 'sqltest-alvinteo@example.com', 100, 'monthly',
   '2024-01-01', '2024-01-01', 'giro', 'cancelled', '2024-01-01', 'sqltest',
   '2024-09-05', 'UOB', 'active', NULL),

  -- 8. CANCELLED (longer lifespan ~9.5 months) -> feeds avg lifespan
  ('11111111-1111-1111-1111-111111111108', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Denise Chua', 'denisechua@example.com', 'sqltest-denisechua@example.com', 60, 'monthly',
   '2023-03-01', '2023-03-01', 'giro', 'cancelled', '2023-03-01', 'sqltest',
   '2023-12-15', 'DBS', 'active', NULL),

  -- 9. TERMINATED bank mandate -> feeds Authorization & Mandate Risk
  ('11111111-1111-1111-1111-111111111109', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Kevin Wong', 'kevinwong@example.com', 'sqltest-kevinwong@example.com', 250, 'monthly',
   '2024-05-01', '2026-06-15', 'giro', 'active', '2024-05-01', 'sqltest',
   NULL, 'UOB', 'terminated', NULL),

  -- 10. PAUSED gift -> feeds Recurring Gift Risk
  ('11111111-1111-1111-1111-111111111110', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Michelle Yeo', 'michelleyeo@example.com', 'sqltest-michelleyeo@example.com', 70, 'monthly',
   '2024-07-01', '2026-07-01', 'giro', 'paused', '2024-07-01', 'sqltest',
   NULL, 'DBS', 'active', NULL),

  -- 11. ENDING SOON (end_date within 6 months) -> feeds Recurring Gift Risk
  ('11111111-1111-1111-1111-111111111111', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Rachel Sim', 'rachelsim@example.com', 'sqltest-rachelsim@example.com', 130, 'monthly',
   '2024-01-01', '2026-07-15', 'giro', 'active', '2024-01-01', 'sqltest',
   NULL, 'DBS', 'active', '2026-10-01'),

  -- 12. FREQUENT SKIPPER (events inserted below) -> feeds Recurring Gift Risk
  ('11111111-1111-1111-1111-111111111112', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Daniel Ong', 'danielong@example.com', 'sqltest-danielong@example.com', 110, 'monthly',
   '2024-06-01', '2026-07-05', 'giro', 'active', '2024-06-01', 'sqltest',
   NULL, 'OCBC', 'active', NULL),

  -- 13. Recently CANCELLED, was active a year ago -> pulls retention rate below 100%
  ('11111111-1111-1111-1111-111111111113', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Wendy Foo', 'wendyfoo@example.com', 'sqltest-wendyfoo@example.com', 95, 'monthly',
   '2024-01-01', '2024-01-01', 'giro', 'cancelled', '2024-01-01', 'sqltest',
   '2026-03-01', 'DBS', 'active', NULL),

  -- 14. PENDING bank authorization -> feeds Authorization & Mandate Risk
  ('11111111-1111-1111-1111-111111111114', (SELECT charity_uen FROM charity_contacts LIMIT 1),
   'Michael Tan', 'michaeltan@example.com', 'sqltest-michaeltan@example.com', 85, 'monthly',
   '2026-06-01', '2026-07-01', 'giro', 'active', '2026-06-01', 'sqltest',
   NULL, 'Standard Chartered', 'pending', NULL);

-- ---------- 2. Donations tied to recurring gifts ----------
-- (drives trend flags, retention/reliability math, and revenue totals)

-- Gift 1 (Tan Wei Ling): increasing amounts -> "upgrade" trend flag
INSERT INTO public.donations
  (created_at, donor_name, charity_uen, amount, status, payment_status, donor_email, recurring_gift_id, source)
VALUES
  ('2026-03-10', 'Tan Wei Ling', (SELECT charity_uen FROM charity_contacts LIMIT 1), 80,  'confirmed', 'confirmed', 'tanweiling@example.com', '11111111-1111-1111-1111-111111111101', 'app'),
  ('2026-04-10', 'Tan Wei Ling', (SELECT charity_uen FROM charity_contacts LIMIT 1), 100, 'confirmed', 'confirmed', 'tanweiling@example.com', '11111111-1111-1111-1111-111111111101', 'app'),
  ('2026-05-10', 'Tan Wei Ling', (SELECT charity_uen FROM charity_contacts LIMIT 1), 120, 'confirmed', 'confirmed', 'tanweiling@example.com', '11111111-1111-1111-1111-111111111101', 'app'),
  ('2026-06-10', 'Tan Wei Ling', (SELECT charity_uen FROM charity_contacts LIMIT 1), 150, 'confirmed', 'confirmed', 'tanweiling@example.com', '11111111-1111-1111-1111-111111111101', 'app');

-- Gift 2 (Muhammad Farid): decreasing amounts -> "downgrade" trend flag
INSERT INTO public.donations
  (created_at, donor_name, charity_uen, amount, status, payment_status, donor_email, recurring_gift_id, source)
VALUES
  ('2026-03-08', 'Muhammad Farid', (SELECT charity_uen FROM charity_contacts LIMIT 1), 300, 'confirmed', 'confirmed', 'mfarid@example.com', '11111111-1111-1111-1111-111111111102', 'app'),
  ('2026-04-08', 'Muhammad Farid', (SELECT charity_uen FROM charity_contacts LIMIT 1), 250, 'confirmed', 'confirmed', 'mfarid@example.com', '11111111-1111-1111-1111-111111111102', 'app'),
  ('2026-05-08', 'Muhammad Farid', (SELECT charity_uen FROM charity_contacts LIMIT 1), 200, 'confirmed', 'confirmed', 'mfarid@example.com', '11111111-1111-1111-1111-111111111102', 'app'),
  ('2026-06-08', 'Muhammad Farid', (SELECT charity_uen FROM charity_contacts LIMIT 1), 150, 'confirmed', 'confirmed', 'mfarid@example.com', '11111111-1111-1111-1111-111111111102', 'app');

-- Gift 4 (Jonathan Koh): steady monthly payments -> feeds reliability & retention, no trend flag
INSERT INTO public.donations
  (created_at, donor_name, charity_uen, amount, status, payment_status, donor_email, recurring_gift_id, source)
VALUES
  ('2026-01-01', 'Jonathan Koh', (SELECT charity_uen FROM charity_contacts LIMIT 1), 120, 'confirmed', 'confirmed', 'jkoh@example.com', '11111111-1111-1111-1111-111111111104', 'app'),
  ('2026-02-01', 'Jonathan Koh', (SELECT charity_uen FROM charity_contacts LIMIT 1), 120, 'confirmed', 'confirmed', 'jkoh@example.com', '11111111-1111-1111-1111-111111111104', 'app'),
  ('2026-03-01', 'Jonathan Koh', (SELECT charity_uen FROM charity_contacts LIMIT 1), 120, 'confirmed', 'confirmed', 'jkoh@example.com', '11111111-1111-1111-1111-111111111104', 'app'),
  ('2026-04-01', 'Jonathan Koh', (SELECT charity_uen FROM charity_contacts LIMIT 1), 120, 'confirmed', 'confirmed', 'jkoh@example.com', '11111111-1111-1111-1111-111111111104', 'app'),
  ('2026-05-01', 'Jonathan Koh', (SELECT charity_uen FROM charity_contacts LIMIT 1), 120, 'confirmed', 'confirmed', 'jkoh@example.com', '11111111-1111-1111-1111-111111111104', 'app'),
  ('2026-06-01', 'Jonathan Koh', (SELECT charity_uen FROM charity_contacts LIMIT 1), 120, 'confirmed', 'confirmed', 'jkoh@example.com', '11111111-1111-1111-1111-111111111104', 'app');
  -- July cycle deliberately left unpaid so reliability isn't a flat 100%

-- Gift 5 (Grace Ng): one annual payment this FY -> feeds reliability
INSERT INTO public.donations
  (created_at, donor_name, charity_uen, amount, status, payment_status, donor_email, recurring_gift_id, source)
VALUES
  ('2026-01-15', 'Grace Ng', (SELECT charity_uen FROM charity_contacts LIMIT 1), 1200, 'confirmed', 'confirmed', 'graceng@example.com', '11111111-1111-1111-1111-111111111105', 'app');

-- ---------- 3. Skip events for the frequent-skipper gift ----------
INSERT INTO public.recurring_gift_events
  (recurring_gift_id, event_type, skipped_cycle_date, reason, created_at, created_by)
VALUES
  ('11111111-1111-1111-1111-111111111112', 'skip', '2026-04-01', 'Donor requested a pause this cycle', '2026-04-01', 'sqltest'),
  ('11111111-1111-1111-1111-111111111112', 'skip', '2026-06-01', 'Donor traveling', '2026-06-01', 'sqltest');
