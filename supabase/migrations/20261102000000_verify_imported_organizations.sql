-- ---------------------------------------------------------------------------
-- Organizations the import created were left unverified
-- ---------------------------------------------------------------------------

-- 20261021000000 added organizations.verified and marked the ones that were
-- already in the database. The import then inserted new organizations without
-- it, so they took the column default of false.
--
-- That matters because of the order docs/LAUNCH.md gives: push the migrations
-- first, import second. Done that way the earlier migration runs against an
-- empty table, finds nothing to mark, and every organization the import then
-- creates arrives unverified. The submit form only suggests organizations
-- somebody has read, so it would suggest none of them, and the whole list
-- would be sitting in "Needs a check" on the first morning.
--
-- The import now inserts them verified, as it always did for venues. This is
-- the same correction for a database that has already been imported, and it
-- is the same statement 20261021000000 ran, deliberately: an organization
-- earns the mark by having been published, which is what an approved event
-- means, or by having been merged into one that was. An organization whose
-- only event is still waiting for review is not marked, because nobody has
-- read its name yet, which is exactly who the list is for.
--
-- Safe to run on a database that does not need it: it sets true where true,
-- and a name an admin has deliberately unverified stays that way unless it
-- also has an approved event.

update public.organizations o
   set verified = true
 where not o.verified
   and (
     o.merged_into is not null
     or exists (select 1 from public.events e where e.organization_id = o.id and e.moderation = 'approved')
   );
