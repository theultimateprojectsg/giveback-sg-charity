# generate-week-summary edge function — v1 (deployed via mcp__supabase__deploy_edge_function)

Not a SQL migration — documents a new deployed Supabase Edge Function since function source
isn't checked into this repo (`supabase/functions/` doesn't exist locally).

## What it does
Takes the same structured weekly stats already computed for the "Your Week So Far" box on the
Dashboard (donor count/total, week-over-week growth, new donors, biggest gift, attention-item
count, expense coverage, plus two new fields: recurring gifts this week, lapsed donors returned
this week) and calls the Anthropic Messages API (`claude-haiku-4-5-20251001`) to write a short,
natural-language 2-4 sentence summary, instead of the fixed template-literal sentences.

Triggered on-demand from a "✨ Generate AI summary" button in `src/App.jsx` (not automatic —
avoids uncontrolled API spend on every dashboard view; no caching/DB column needed as a result).
The existing templated sentence stays as the default/fallback — this is additive.

## Requires
`ANTHROPIC_API_KEY` set as a Supabase Edge Function secret (Project Settings → Edge Functions →
Secrets). Unknown whether this was already configured when this was written — the function
returns a clear `{ error: 'ANTHROPIC_API_KEY not configured' }` if missing, and the UI surfaces
that as "AI summary isn't set up yet — ask your admin to add an Anthropic API key."

## Verification
No way to test the real Anthropic call without spending against a real key, so verified by
extracting the fact-building logic into a throwaway local script and inspecting the exact
fact list/prompt that would be sent, for both a busy week and an empty week (zero-value fields
correctly omitted, singular/plural handled). Real end-to-end confirmation requires clicking the
button while logged in as a charity with the secret configured.
