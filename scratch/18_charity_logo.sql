-- Adds a charity logo so donation receipts (and eventually other exports) can be branded.
-- Run in the Supabase SQL editor (the connected MCP server is read-only, can't apply this directly).

alter table public.charity_contacts add column if not exists logo_url text;

insert into storage.buckets (id, name, public)
values ('charity-assets', 'charity-assets', true)
on conflict (id) do nothing;

-- Public read (logos need to render in a downloaded/emailed PDF with no auth context).
drop policy if exists "Public read charity assets" on storage.objects;
create policy "Public read charity assets"
on storage.objects for select
using (bucket_id = 'charity-assets');

-- Any authenticated charity staff user can upload/replace/delete their own logo.
-- (Matches the app's existing trust model: all writes elsewhere are gated by being logged in,
-- not by fine-grained per-charity storage rules.)
drop policy if exists "Authenticated upload charity assets" on storage.objects;
create policy "Authenticated upload charity assets"
on storage.objects for insert
with check (bucket_id = 'charity-assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated update charity assets" on storage.objects;
create policy "Authenticated update charity assets"
on storage.objects for update
using (bucket_id = 'charity-assets' and auth.role() = 'authenticated');

drop policy if exists "Authenticated delete charity assets" on storage.objects;
create policy "Authenticated delete charity assets"
on storage.objects for delete
using (bucket_id = 'charity-assets' and auth.role() = 'authenticated');
