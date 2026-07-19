# send-thank-you edge function — v6 (deployed via mcp__supabase__deploy_edge_function)

Not a SQL migration — this documents a deployed Supabase Edge Function change since the
function source isn't checked into this repo (`supabase/functions/` doesn't exist locally).

## What changed
For the 5 "receipt-style" templates (`standard`, `major_gift`, `new_donor`, `recurring_donor`,
`nric_request`), `custom_message` used to be appended as an *extra* paragraph below a fixed,
hardcoded intro sentence — causing duplicate-sounding emails when a charity set a Settings
template (e.g. "Your first gift means more than the number on this receipt..." shown twice).

- `major_gift` / `new_donor` / `recurring_donor`: the fixed intro sentence is removed.
  `custom_message` (if present) now fully replaces it; if absent, no intro paragraph renders
  (matches how `standard` already worked). `new_donor` and `recurring_donor` gained a small
  always-rendered "Amount" row (styled like `major_gift`'s existing one) so the donation amount
  is never lost even if `custom_message` is blank — previously it only appeared inline inside
  the now-removed fixed sentence.
- `nric_request`: fixed a missing HTML-escape on the optional custom-message quote block
  (`payload.custom_message` was interpolated raw — no `.replace(/</g,'&lt;')...` — unlike every
  other branch in the file). The IRAS 250%-tax-deduction explanation stays fixed/protected
  since it's compliance text with real financial consequences if altered.
- `standard`: unchanged — already had this pattern correct.

## Why
Prompted by a user report of duplicate wording in `new_donor` receipts (Settings →
Email Templates default body echoed the same sentiment already baked into the edge function's
HTML). Root cause + fix discussed in-session; verified via a local dry-run harness (extracted
the HTML-building logic into a throwaway Node script and ran it against sample payloads,
including an XSS payload in `custom_message` to confirm escaping) before deploying — no local
copy of the function exists so this couldn't be tested any other way without sending real email.

No `src/App.jsx` changes were needed: `EMAIL_TEMPLATE_DEFAULTS` bodies for these 5 templates
were already `''` (opt-in only), and `subject_override`/`custom_message` were already wired
through `sendCharityEmail` for all 5.
