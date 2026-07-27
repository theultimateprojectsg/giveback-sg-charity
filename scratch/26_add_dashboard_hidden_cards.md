# add_dashboard_hidden_cards migration

Applied via mcp__supabase__apply_migration.

## What changed
`charity_contacts` gained `dashboard_hidden_cards` (jsonb, default `[]`).

## Why
Charities asked to hide dashboard cards they don't use. Piloting on the Financial
Overview section first: each charity can now hide any of its three blocks
(Annual Fundraising Goal, Key Metrics, Funding Mix Snapshot) via a "⚙ Customize"
popover in that section's header. Hidden card keys (`fo_goal`, `fo_keyMetrics`,
`fo_fundingMix`) are stored as a flat array so the same column can be reused for
other sections later without a schema change.

Follows the same race-safe read-modify-write pattern as `enabled_modules`
(`toggleDashboardCard` in `App.tsx`, using the existing `updateCharityJsonField`
helper).

Verified in the browser: unchecked "Funding Mix Snapshot", confirmed the block
disappeared immediately and stayed hidden after a full page reload, then
re-checked it and confirmed it reappeared.
