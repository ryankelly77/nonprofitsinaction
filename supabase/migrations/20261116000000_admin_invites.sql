-- ---------------------------------------------------------------------------
-- Who may add and remove the people who review listings
-- ---------------------------------------------------------------------------

-- Until now every admin was equal and the only way to add one was SQL. The
-- calendar is handed over to people who do not write SQL, so adding and
-- removing admins moves into the admin itself, and one person holds that
-- power rather than everyone.
alter table public.admins add column super_admin boolean not null default false;

-- Who invited this person, kept so the list can say where someone came from.
-- Deliberately not a foreign key: removing the person who did the inviting
-- must not take their invitees with them, or remove a row nobody can see.
alter table public.admins add column invited_by text;

-- Set on each sign-in, so the list can show who has actually used their
-- invitation and who was added and never came.
alter table public.admins add column last_seen_at timestamptz;

update public.admins set super_admin = true where email = 'ryan@pearanalytics.com';

-- A database whose first admin is somebody else still ends up with one, so
-- this never leaves a calendar with admins but nobody who can manage them.
update public.admins
   set super_admin = true
 where email = (select email from public.admins order by created_at, email limit 1)
   and not exists (select 1 from public.admins where super_admin);
