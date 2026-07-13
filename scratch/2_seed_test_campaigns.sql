-- Seeds test campaigns covering every new field, so you can exercise the Campaigns tab.
-- Replace YOUR_CHARITY_UEN / YOUR_CHARITY_NAME with your actual values before running
-- (find them in charity_contacts, or on any existing row in causes/grants).

with new_causes as (
  insert into causes (
    title, description, charity_name, charity_uen,
    target_amount, cost, start_date, end_date,
    category, tax_deductible, benefit_value,
    permit_number, permit_status, permit_expiry,
    type, status, active
  ) values
  -- 1. Straightforward IPC-deductible campaign, on pace
  (
    'Winter Meal Drive', 'Providing hot meals to low-income families this winter.',
    'YOUR_CHARITY_NAME', 'YOUR_CHARITY_UEN',
    10000, 1500, current_date - interval '10 days', current_date + interval '20 days',
    'Social & Welfare', true, 0,
    null, 'not_required', null,
    'campaign', 'approved', true
  ),
  -- 2. Non-tax-deductible campaign (donor gets a benefit in return) — tests the IPC-only badge
  (
    'Charity Gala Dinner', 'Annual fundraising dinner with entertainment and a 4-course meal.',
    'YOUR_CHARITY_NAME', 'YOUR_CHARITY_UEN',
    20000, 8000, current_date - interval '5 days', current_date + interval '40 days',
    'Arts & Heritage', false, 88,
    null, 'not_required', null,
    'campaign', 'approved', true
  ),
  -- 3. Street collection campaign with a pending permit — tests permit badge
  (
    'Flag Day Street Collection', 'Volunteers collecting donations door-to-door and on the street.',
    'YOUR_CHARITY_NAME', 'YOUR_CHARITY_UEN',
    5000, 300, current_date, current_date + interval '14 days',
    'Community Development', true, 0,
    'HHSC-2026-0042', 'pending', current_date + interval '90 days',
    'campaign', 'approved', true
  ),
  -- 4. Campaign with an expired permit — tests the expired-permit warning badge
  (
    'Neighbourhood Collection Box Drive', 'Physical donation boxes placed around the neighbourhood.',
    'YOUR_CHARITY_NAME', 'YOUR_CHARITY_UEN',
    3000, 200, current_date - interval '120 days', current_date - interval '30 days',
    'Community Development', true, 0,
    'HHSC-2025-1187', 'obtained', current_date - interval '10 days',
    'campaign', 'completed', true
  ),
  -- 5. Behind-pace campaign, no category set, no permit — tests default/blank states
  (
    'Emergency Relief Fund', 'Rapid-response fund for families affected by recent flooding.',
    'YOUR_CHARITY_NAME', 'YOUR_CHARITY_UEN',
    15000, 0, current_date - interval '25 days', current_date + interval '5 days',
    null, true, 0,
    null, 'not_required', null,
    'campaign', 'approved', true
  ),
  -- 6. Pending approval campaign — tests the pending workflow state
  (
    'Youth Mentorship Programme Launch', 'New mentorship pairing programme for at-risk youth.',
    'YOUR_CHARITY_NAME', 'YOUR_CHARITY_UEN',
    8000, 0, current_date + interval '10 days', current_date + interval '100 days',
    'Education', true, 0,
    null, 'not_required', null,
    'campaign', 'pending', true
  )
  returning id, title
)
insert into campaign_expenses (cause_id, description, amount, expense_date, category)
select id, 'Venue deposit', 3000, current_date - interval '4 days', 'Venue & Logistics'
from new_causes where title = 'Charity Gala Dinner'
union all
select id, 'Printed invitations', 1200, current_date - interval '3 days', 'Printing & Materials'
from new_causes where title = 'Charity Gala Dinner'
union all
select id, 'Facebook & Instagram ads', 500, current_date - interval '8 days', 'Marketing & Promotion'
from new_causes where title = 'Winter Meal Drive'
union all
select id, 'Collection tins & vests', 300, current_date - interval '2 days', 'Printing & Materials'
from new_causes where title = 'Flag Day Street Collection';
