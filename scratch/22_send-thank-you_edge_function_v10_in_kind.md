# send-thank-you edge function — v10 (deployed via mcp__supabase__deploy_edge_function)

Not a SQL migration — this documents a deployed Supabase Edge Function change since the
function source isn't checked into this repo (`supabase/functions/` doesn't exist locally).

## What changed
Added a new `payload.type === 'in_kind_thank_you'` branch (`isInKindThankYou`). Renders a
"Gift Details" card (Charity / Item / Date / Cause) instead of the cash "Donation Details"
box, has no Amount row, no tax-deduction reminder block, and no receipt PDF attachment —
closes with an explicit line: "This acknowledges a gift-in-kind and is not a cash donation
receipt — it does not carry a tax deduction." Subject falls back to
`Thank you for your gift, ${donor_name}!` when no `subject_override` is supplied.

New payload fields read: `item_description` (escaped into `safeItemDescription`). Reuses
existing `cause_title`, `date`, `custom_message`, `charity_name` fields already read for
other template types.

## Why
The in-kind "💌 Thanked" button previously just flipped a DB flag with no email — no preview,
no send, nothing. Confusing (user assumed something had been sent when it hadn't) and
inconsistent with cash donations, which go through a real preview → send flow. Added a
matching flow client-side in `src/App.tsx` (`inKindThankYouModal` state,
`buildInKindThankYouPreviewHtml`, `sendInKindThankYouEmail`, `toggleInKindThankYou` now
opens the compose modal instead of directly flipping the flag when marking as thanked;
unmarking still flips it directly since no email needs to be sent to un-send).

Verified end-to-end in the live app: logged a test in-kind gift with a real email, sent
the thank-you through the full preview → send flow, confirmed `thank_you_sent` flipped to
`true` in the DB and an `in_kind_thank_you_sent` audit_log row was written, then deleted
the test entry.
