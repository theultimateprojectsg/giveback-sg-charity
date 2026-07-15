-- One pledge ("PledgeX") was created after the initial reference backfill (16_...) but before the
-- app had picked up the code change that generates a reference on new pledges, so it slipped
-- through with reference = null. This catches any pledge still missing one.
-- Run in the Supabase SQL editor.

update public.pledges
set reference = 'PLG-' || upper(substr(md5(id::text || now()::text), 1, 8))
where reference is null;
