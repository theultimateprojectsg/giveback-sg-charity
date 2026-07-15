-- Enforces "only an Executive Director can confirm a payment" at the database level, not just
-- in the app's UI. The app-side fix (hiding the Confirm button from non-ED users) stops the normal
-- app flow from doing it, but anyone could still call the same Supabase update directly (e.g. via
-- browser devtools) and bypass a UI-only restriction. This trigger makes that impossible.
--
-- Scope: only gates the specific transition of payment_status becoming 'confirmed' via UPDATE —
-- i.e. the live "someone marks a real donation as paid" action (the Donations list's "Confirm"
-- button and the PayNow QR modal's "Payment Received" button, both of which call the same
-- underlying update). It deliberately does NOT touch INSERTs, so it won't break the CSV Migration
-- Tool (which bulk-inserts historical rows already marked confirmed) or the pledge/recurring-gift
-- "mark received" flows (which insert a new confirmed donation record directly, not update
-- an existing one) — those are separate write paths with their own existing UI gating.
--
-- Assumes charity_contacts.ed_emails holds the list of ED emails for a charity_uen, matching how
-- the app already reads/writes it (works whether the column is text[] or jsonb, since to_jsonb()
-- normalizes either representation before the containment check).
-- Run in the Supabase SQL editor.

create or replace function public.enforce_payment_confirmation_role()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := nullif(auth.jwt() ->> 'email', '');
  v_is_ed boolean;
begin
  -- Only gate the transition INTO 'confirmed' — every other update passes through untouched.
  if NEW.payment_status = 'confirmed' and (OLD.payment_status is distinct from 'confirmed') then
    select to_jsonb(coalesce(ed_emails, '{}')) @> to_jsonb(array[lower(coalesce(v_email, ''))])
      into v_is_ed
      from public.charity_contacts
      where charity_uen = NEW.charity_uen;

    if not coalesce(v_is_ed, false) then
      raise exception 'Only an Executive Director can confirm a payment for this charity.';
    end if;
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_enforce_payment_confirmation_role on public.donations;

create trigger trg_enforce_payment_confirmation_role
  before update on public.donations
  for each row
  execute function public.enforce_payment_confirmation_role();
