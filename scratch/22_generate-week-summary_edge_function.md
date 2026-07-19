# generate-week-summary edge function — v2 (deployed via mcp__supabase__deploy_edge_function)

Not a SQL migration — documents a new deployed Supabase Edge Function since function source
isn't checked into this repo (`supabase/functions/` doesn't exist locally).

## What it does
Takes the same structured weekly stats already computed for the "Your Week So Far" box on the
Dashboard (donor count/total, week-over-week growth, new donors, biggest gift amount,
attention-item count, expense coverage, plus two new fields: recurring gifts this week, lapsed
donors returned this week) and calls the Anthropic Messages API (`claude-haiku-4-5-20251001`)
to write a short, natural-language 2-4 sentence summary, instead of the fixed template-literal
sentences.

Triggered on-demand from a "✨ Generate AI summary" button in `src/App.jsx` (not automatic —
avoids uncontrolled API spend on every dashboard view; no caching/DB column needed as a result).
The existing templated sentence stays as the default/fallback — this is additive.

## Data sent to Anthropic (v2 — privacy-reviewed)
**Only aggregate counts and totals belonging to the charity itself — no personal data of any
kind.** v1 briefly included the biggest-gift donor's real name (`biggestGift.donor_name`) in
the payload; this was caught in review before it shipped to real users and removed in v2 —
the payload now sends `biggestGiftAmount` (a number) instead of the donor object. The system
prompt explicitly tells Claude no donor is named and to never invent or guess one.

Full payload fields: `charity_name` (the charity's own name, not private), `weekTotal`,
`weekDonorCount`, `weekGrowthPct`, `newDonorsThisWeek`, `biggestGiftAmount`, `attentionCount`,
`monthlyExpensesSet`, `coverageOk`, `recurringGiftsThisWeekCount`, `recurringGiftsThisWeekTotal`,
`lapsedReturningCount`. No donor names, emails, NRICs, addresses, or any other donor-level
identifiers are ever included. This is stated in-app next to the button, not just here.

Anthropic's standard commercial API (not consumer Claude.ai) does not train on API inputs/
outputs by default and retains request data only for a limited abuse-monitoring window per
their published API terms — charities with stricter requirements (e.g. wanting a zero-retention
agreement) should talk to Anthropic directly; this app doesn't currently do anything beyond the
default API terms.

## Requires
`ANTHROPIC_API_KEY` set as a Supabase Edge Function secret (Project Settings → Edge Functions →
Secrets). Unknown whether this was already configured when this was written — the function
returns a clear `{ error: 'ANTHROPIC_API_KEY not configured' }` if missing, and the UI surfaces
that as "AI summary isn't set up yet — ask your admin to add an Anthropic API key."

## Verification
No way to test the real Anthropic call without spending against a real key, so verified by
extracting the fact-building logic into a throwaway local script and inspecting the exact
fact list/prompt that would be sent, for both a busy week and an empty week (zero-value fields
correctly omitted, singular/plural handled, no name-like tokens present). Real end-to-end
confirmation requires clicking the button while logged in as a charity with the secret
configured.
