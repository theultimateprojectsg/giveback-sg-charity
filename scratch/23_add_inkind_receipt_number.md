# add_inkind_receipt_number migration

Applied via mcp__supabase__apply_migration.

## What changed
- `in_kind_donations` gained `receipt_number` (text), `receipt_issued` (boolean, default
  false), `receipt_issued_at` (timestamptz).
- New table `inkind_receipt_number_counters` (charity_uen, year, last_seq) — RLS enabled,
  no policies (matches `receipt_number_counters`: only reachable via the SECURITY DEFINER
  RPC below, which does its own JWT charity check).
- New RPC `next_inkind_receipt_number(p_charity_uen, p_year)` — same shape as the existing
  `next_receipt_number`, but produces `IK-{year}-{seq6}` instead of `MR-{year}-{seq6}` and
  increments its own counter table, so it never shares or collides with the cash-donation
  sequence.

## Why
User asked why in-kind gifts didn't get a receipt number, and pointed out that even a
non-IPC charity still issues *receipts* for cash donations (`receipt_issued`/
`receipt_number` on `donations` isn't gated by `charityIsIpc` at all) — the IPC/non-IPC
distinction only affects whether a *tax deduction* claim is possible, not whether a receipt
exists. In-kind gifts can't get a tax deduction either way (IRAS doesn't grant deductions for
non-cash gifts under the standard scheme, regardless of IPC status), but that's a separate
question from acknowledging receipt of the gift — so a lightweight, clearly-labeled
"acknowledgement of gift-in-kind" receipt was added, explicitly distinct from the cash
donation receipt (separate numbering series, separate PDF template, explicit
non-tax-deductible disclaimer on the document itself).

Client side: `issueInKindReceipt()`, `generateInKindReceiptPDFDoc()`, and
`exportInKindReceiptPDF()` in `src/App.tsx`; "🧾 Issue Receipt" / "⬇️ Download Receipt PDF"
button and a Receipt column/badge in `src/pages/InKindDonationsPage.tsx`.
