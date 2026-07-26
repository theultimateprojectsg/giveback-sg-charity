# add_inkind_void_reissue_columns migration

Applied via mcp__supabase__apply_migration.

## What changed
`in_kind_donations` gained: `receipt_voided` (boolean, default false), `voided_at`
(timestamptz), `voided_by` (text), `void_reason` (text), `reissued_from` (text).

## Why
Asked directly: "did we really cover everything for in-kind donations" — an audit against
the Donations page turned up that Donations supports voiding a mistakenly-issued receipt
(wrong amount, misspelled name, etc.) and reissuing a corrected one with a new sequential
number, keeping the old one on record with a reason. In-Kind's receipt system (added
earlier this session) had no equivalent — a mistake in an issued IK- receipt had no clean
fix path. Added `voidAndReissueInKindReceipt()` in `src/App.tsx`, mirroring
`voidAndReissueReceipt()` for cash donations exactly (void old → generate new number via
`next_inkind_receipt_number` → reissue → reset `thank_you_sent` since the reissued receipt
needs a fresh thank-you), plus a "🚫 Void & Reissue Receipt" button and confirmation modal
in `src/pages/InKindDonationsPage.tsx`, and "Reissued from" / "Status: VOIDED" facts on the
PDF (`generateInKindReceiptPDFDoc`).

Verified end-to-end: issued a receipt, voided it with a reason, confirmed the new
sequential number, `reissued_from` pointing at the old number, and an
`inkind_receipt_voided_and_reissued` audit log entry, then reset the test entry.
