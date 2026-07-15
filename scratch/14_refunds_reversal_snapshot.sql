-- Lets deleting a refund record (correcting a mistaken refund) fully restore the pledge/recurring
-- side-effects that saveRefund unwinds when the refund is first recorded — not just the donation's
-- payment_status. Without this, undoing a refund only set the donation back to 'confirmed' but left
-- any unlinked pledge and any rolled-back recurring-gift dates/totals permanently reversed.
-- Run in the Supabase SQL editor.

alter table public.refunds
  add column if not exists unlinked_pledge_id uuid references public.pledges(id),
  add column if not exists unlinked_pledge_amount_applied numeric,
  add column if not exists pledge_was_fulfilled boolean,
  add column if not exists recurring_gift_id uuid references public.recurring_gifts(id),
  add column if not exists recurring_gift_prior_last_received date,
  add column if not exists recurring_gift_prior_next_expected date;
