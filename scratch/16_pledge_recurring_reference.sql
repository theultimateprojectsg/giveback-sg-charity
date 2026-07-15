-- Adds an auto-generated reference number to pledges and recurring gifts, mirroring the
-- receipt_number donations already get, so both can be cited (e.g. to a donor or on a bank
-- statement) and so a donation generated from one (pledge fulfillment / recurring "Mark Received")
-- can show which pledge/recurring gift it came from in the Donation Details modal.
-- Run in the Supabase SQL editor (the connected MCP server is read-only, can't apply this directly).

alter table public.pledges add column if not exists reference text;
alter table public.recurring_gifts add column if not exists reference text;

update public.pledges set reference = 'PLG-' || upper(substr(md5(id::text), 1, 8)) where reference is null;
update public.recurring_gifts set reference = 'RG-' || upper(substr(md5(id::text), 1, 8)) where reference is null;
