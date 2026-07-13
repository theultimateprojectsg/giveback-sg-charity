-- Removes all existing campaigns (causes.type = 'campaign') so you can test the new
-- fields on a clean slate. Unlinks (does not delete) any donations/grants/appeals/
-- pledges/recurring gifts that were tagged to a campaign, so that data isn't lost.
-- Run in the Supabase SQL editor. Recommended: run on a test project, not production.

begin;

update donations       set cause_id = null where cause_id in (select id from causes where type = 'campaign');
update grants          set cause_id = null where cause_id in (select id from causes where type = 'campaign');
update mass_appeals    set cause_id = null where cause_id in (select id from causes where type = 'campaign');
update recurring_gifts set cause_id = null where cause_id in (select id from causes where type = 'campaign');
update pledges         set cause_id = null where cause_id in (select id from causes where type = 'campaign');

delete from campaign_expenses where cause_id in (select id from causes where type = 'campaign');
delete from causes where type = 'campaign';

commit;
