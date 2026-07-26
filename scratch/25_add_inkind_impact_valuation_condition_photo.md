# add_inkind_impact_valuation_condition_photo migration

Applied via mcp__supabase__apply_migration.

## What changed
`in_kind_donations` gained: `impact_note` (text), `valuation_basis` (text), `condition`
(text), `photo_url` (text).

## Why
Follow-up to the earlier product-completeness audit (asked directly whether the in-kind
feature covers everything small charities actually need). Four items, all implemented:

- **Impact Note** — a second editable note ("The Difference Your Gift Made"), mirroring
  `donations.impact_note` exactly, shown on the receipt PDF in the same gold quote-block
  style.
- **Valuation basis** — free-text field recording how the estimated value was determined
  (retail price, donor-quoted, etc.). GIK still has to go into the charity's financial
  statements at a defensible fair value even with no tax angle, so this documents the basis
  for that.
- **Condition** — New / Used - Good / Used - Fair, relevant mainly for goods.
- **Photo** — proof-of-receipt photo upload, reusing the existing public `charity-assets`
  storage bucket and its `{charity_uen}/...` path-prefix RLS policy (same pattern as
  `uploadCharityLogo`), stored at `{charity_uen}/inkind/{item.id}.{ext}`.

All four appear in the detail modal, the Gift Details fact list, the receipt PDF (where
applicable), and the Excel export. Form gained Condition/Valuation Basis fields; photo
upload lives in the detail modal only (record must exist first, since the storage path
needs the row's id).

Verified in the browser: created a test entry with condition="New" and a valuation basis
string, confirmed both persisted and rendered in the detail modal and PDF facts; edited
and saved an impact note, confirmed it persisted and rendered in the gold quote box in
both the modal and the PDF. Photo upload's `onChange` handler couldn't be fully exercised
via a synthetic file-input event in the browser-automation harness (a known limitation of
simulating native file pickers, not a code issue) — verified instead by code parity with
the existing, working `uploadCharityLogo` upload path and by confirming the storage RLS
policy accepts the `{charity_uen}/inkind/{id}.{ext}` path shape used here.
