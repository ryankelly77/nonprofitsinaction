-- ---------------------------------------------------------------------------
-- Organizations get the check venues already had
-- ---------------------------------------------------------------------------

-- A venue typed into the form starts unverified and is kept off the
-- suggestions until an admin has looked at it, so one person's "Wittie
-- Museum" is never offered to the next. Organizations had no such state: a
-- new one appeared in the list with nothing marking it as new, and the
-- suggestions added alongside this would have handed the typo straight on.
--
-- Same rule for both now. Unverified means nobody has checked the name yet;
-- it does not hide the organization or hold up anything else, and approving
-- an event is what vouches for it, exactly as with a venue.

alter table public.organizations add column verified boolean not null default false;

-- Everything already on the calendar has been through a person once: the
-- import brought these in from the live WordPress site, where they were
-- published. Marking them checked keeps the review list to what is actually
-- new rather than opening it with 122 names nobody needs to read again.
update public.organizations o
   set verified = true
 where o.merged_into is not null
    or exists (select 1 from public.events e where e.organization_id = o.id and e.moderation = 'approved');

create index organizations_unverified on public.organizations (name) where not verified and merged_into is null;

-- Who can read an organization is unchanged: its first approved event still
-- decides that. Being verified only governs whether the submit form offers
-- the name to the next person.
