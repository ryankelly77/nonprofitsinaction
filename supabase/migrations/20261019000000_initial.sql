-- Nonprofits in Action: the calendar's whole data model.
--
-- Who can read what is decided here, in row level security, and nowhere else.
-- The public (the anon key) can read approved events and the organizations,
-- venues and lookups they point to. Nothing else is readable, and nothing at
-- all is writable, with the anon key. Every write happens on the server with
-- the service role, after the server has validated it: a submission, an admin
-- action or the import.
--
-- Private details (who submitted an event, their email, the token behind
-- their edit link) live in `submissions`, which has no public policy. The
-- events table holds nothing that cannot be shown on the event page.

create extension if not exists pg_trgm with schema extensions;

-- ---------------------------------------------------------------------------
-- Lookups
-- ---------------------------------------------------------------------------

-- The kind of event. Admins can add more or retire one (active = false keeps
-- old events typed while removing the choice from the form).
create table public.event_types (
  slug    text primary key,
  label   text not null,
  plural  text not null,
  sort    int  not null default 0,
  active  boolean not null default true
);

insert into public.event_types (slug, label, plural, sort) values
  ('gala',           'Gala',                   'Galas',                  10),
  ('luncheon',       'Luncheon',               'Luncheons',              20),
  ('breakfast',      'Breakfast',              'Breakfasts',             30),
  ('dinner',         'Dinner',                 'Dinners',                40),
  ('run-walk',       'Run / walk',             'Runs & walks',           50),
  ('golf',           'Golf tournament',        'Golf',                   60),
  ('sporting-event', 'Sporting event',         'Sporting events',        70),
  ('festival',       'Festival',               'Festivals',              80),
  ('concert',        'Concert',                'Concerts',               90),
  ('conference',     'Conference / workshop',  'Conferences & workshops', 100),
  ('community',      'Volunteer / info session', 'Volunteer & info sessions', 110),
  ('other',          'Other',                  'Other events',           999);

-- The cause an organization serves. These are the eighteen organization
-- types on the old listing form, unchanged, so imported answers map 1:1.
create table public.causes (
  slug   text primary key,
  label  text not null,
  sort   int  not null default 0
);

insert into public.causes (slug, label, sort) values
  ('animals',                  'Animals',                          10),
  ('arts-culture',             'Arts & Culture',                   20),
  ('chamber-of-commerce',      'Chamber of Commerce',              30),
  ('disabilities',             'Disabilities & Special Needs',     40),
  ('community-development',    'Economic/Community Development',   50),
  ('education',                'Education',                        60),
  ('environmental',            'Environmental',                    70),
  ('foundation',               'Foundation',                       80),
  ('health-care',              'Health Care',                      90),
  ('housing',                  'Housing Assistance',              100),
  ('media',                    'Media Outlets',                   110),
  ('mental-health',            'Mental Health',                   120),
  ('professional-association', 'Professional Association',        130),
  ('religious',                'Religious',                       140),
  ('social-services',          'Social Services',                 150),
  ('sports',                   'Sports',                          160),
  ('veterans',                 'Veterans',                        170),
  ('youth',                    'Youth Activities',                180);

create type public.org_sector        as enum ('nonprofit', 'for_profit', 'public');
create type public.event_format      as enum ('in_person', 'virtual', 'hybrid');
create type public.moderation_status as enum ('pending', 'approved', 'rejected');
create type public.event_status      as enum ('scheduled', 'cancelled', 'postponed');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

-- A name reduced to letters and digits, lower case: "NAMI Greater San
-- Antonio", "Nami Greater San-Antonio" and "NAMI  Greater San Antonio" all
-- become "namigreatersanantonio". Used to find the record a typed name
-- already belongs to, never shown.
create function public.name_key(value text) returns text
language sql immutable parallel safe
as $$ select lower(regexp_replace(coalesce(value, ''), '[^[:alnum:]]+', '', 'g')) $$;

create function public.touch_updated_at() returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Organizations and venues
-- ---------------------------------------------------------------------------

create table public.organizations (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  name_key        text generated always as (public.name_key(name)) stored,
  cause_slug      text references public.causes (slug),
  sector          public.org_sector,
  website         text,
  description     text,
  -- Set when an admin merges a duplicate into the record it duplicates. The
  -- duplicate stays (its old address redirects) but is no longer shown.
  merged_into     uuid references public.organizations (id),
  legacy_term_id  int unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index organizations_name_key on public.organizations (name_key);
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();

create table public.venues (
  id              uuid primary key default gen_random_uuid(),
  name            text not null,
  slug            text not null unique,
  name_key        text generated always as (public.name_key(name)) stored,
  address_line1   text,
  address_line2   text,
  city            text,
  state           text,
  postal_code     text,
  latitude        double precision,
  longitude       double precision,
  website         text,
  -- A venue an admin has checked. New venues typed into the form start
  -- unverified and are offered to later submitters only once verified, so a
  -- typo is never suggested to the next person.
  verified        boolean not null default false,
  merged_into     uuid references public.venues (id),
  legacy_term_id  int unique,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index venues_name_key on public.venues (name_key);
create index venues_name_trgm on public.venues using gin (name extensions.gin_trgm_ops);
create trigger venues_touch before update on public.venues
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Submissions (private)
-- ---------------------------------------------------------------------------

-- One row per time someone filled in the form (or per imported Gravity Forms
-- entry). It owns the private edit link: the link carries a random token, and
-- only its SHA-256 is stored here, so a database read never yields a working
-- link.
create table public.submissions (
  id                 uuid primary key default gen_random_uuid(),
  submitter_name     text not null,
  submitter_email    text not null,
  organization_id    uuid references public.organizations (id),
  manage_token_hash  text unique,
  -- When a fresh link was last emailed from /manage/. New links are not sent
  -- more than once in 15 minutes, so nobody can keep invalidating someone
  -- else's link by asking for new ones.
  manage_link_sent_at timestamptz,
  source             text not null default 'web' check (source in ('web', 'admin', 'eventon-import')),
  legacy_entry_id    int unique,
  created_at         timestamptz not null default now()
);
create index submissions_email on public.submissions (lower(submitter_email));

-- ---------------------------------------------------------------------------
-- Events
-- ---------------------------------------------------------------------------

create table public.events (
  id               uuid primary key default gen_random_uuid(),
  slug             text not null unique,
  title            text not null check (length(trim(title)) > 0),
  description      text,
  organization_id  uuid not null references public.organizations (id),
  venue_id         uuid references public.venues (id),
  event_type_slug  text references public.event_types (slug),
  format           public.event_format not null default 'in_person',

  -- Instants, stored in UTC like every timestamptz. The calendar is San
  -- Antonio's, so they are entered and shown in time_zone; the conversion
  -- happens in lib/time.ts and is tested across both DST changes. Never store
  -- a local wall-clock time as if it were UTC (that is the EventON habit the
  -- import undoes).
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  all_day          boolean not null default false,
  time_zone        text not null default 'America/Chicago',

  online_url       text,
  ticket_url       text,
  image_path       text,

  moderation       public.moderation_status not null default 'pending',
  status           public.event_status not null default 'scheduled',
  rejection_reason text,
  featured         boolean not null default false,

  submission_id    uuid references public.submissions (id),

  -- From the import. legacy_slugs holds every address WordPress ever gave the
  -- event, so an old link still finds it.
  legacy_post_id   int unique,
  legacy_slugs     text[] not null default '{}',
  -- Questions the import could not settle on its own, for an admin to clear:
  -- 'time-unverified', 'time-corrected', 'no-venue', 'venue-new'.
  review_flags     text[] not null default '{}',

  published_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),

  -- Title, description, host and venue, kept current by events_search_refresh
  -- below, so a search for "NAMI" or "Witte" finds the events of that host or
  -- at that venue as well as events with the word in the title.
  search           tsvector,

  constraint events_end_after_start check (ends_at >= starts_at)
);
create index events_upcoming  on public.events (starts_at) where moderation = 'approved';
create index events_ends      on public.events (ends_at)   where moderation = 'approved';
create index events_pending   on public.events (created_at) where moderation = 'pending';
create index events_org       on public.events (organization_id);
create index events_venue     on public.events (venue_id);
create index events_search    on public.events using gin (search);
create index events_legacy_slugs on public.events using gin (legacy_slugs);
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

create function public.events_search_refresh() returns trigger
language plpgsql
as $$
declare
  host text;
  place text;
begin
  select name into host from public.organizations where id = new.organization_id;
  select name into place from public.venues where id = new.venue_id;
  new.search :=
    setweight(to_tsvector('english', coalesce(new.title, '')), 'A') ||
    setweight(to_tsvector('english', coalesce(host, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(place, '')), 'C') ||
    setweight(to_tsvector('english', coalesce(new.description, '')), 'D');
  return new;
end;
$$;
create trigger events_search before insert or update of title, description, organization_id, venue_id on public.events
  for each row execute function public.events_search_refresh();

-- When a host or venue is renamed, its events are re-indexed.
create function public.events_search_follow_rename() returns trigger
language plpgsql
as $$
begin
  if new.name is distinct from old.name then
    if tg_table_name = 'organizations' then
      update public.events set title = title where organization_id = new.id;
    else
      update public.events set title = title where venue_id = new.id;
    end if;
  end if;
  return new;
end;
$$;
create trigger organizations_rename_reindex after update of name on public.organizations
  for each row execute function public.events_search_follow_rename();
create trigger venues_rename_reindex after update of name on public.venues
  for each row execute function public.events_search_follow_rename();

-- What happened to each event, by whom. Written by the server on every
-- create, edit, approval, rejection and cancellation.
create table public.event_changes (
  id          bigint generated always as identity primary key,
  event_id    uuid not null references public.events (id) on delete cascade,
  actor       text not null,   -- 'admin:<email>', 'submitter', 'import'
  action      text not null,   -- 'created', 'edited', 'approved', 'rejected', 'cancelled', 'postponed', 'restored'
  changes     jsonb,
  created_at  timestamptz not null default now()
);
create index event_changes_event on public.event_changes (event_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Holidays
-- ---------------------------------------------------------------------------

-- Days a planner should know about before picking a date (Thanksgiving,
-- Easter, Election Day). Shown on the calendars and in the date check, never
-- listed as events. The old site kept these as EventON events of the type
-- "US Holidays"; the import moves them here.
create table public.holidays (
  id    bigint generated always as identity primary key,
  date  date not null,
  name  text not null,
  unique (date, name)
);

-- ---------------------------------------------------------------------------
-- Admins
-- ---------------------------------------------------------------------------

-- Who may sign in to /admin. Sign-in is a magic link from Supabase Auth; the
-- address has to be in this table as well, or the session is refused.
create table public.admins (
  email       text primary key check (email = lower(email)),
  name        text,
  -- Receives an email for every new submission.
  notify      boolean not null default true,
  created_at  timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Merging duplicates
-- ---------------------------------------------------------------------------

-- Fold one venue (or organization) into another in a single transaction:
-- its events move, its history notes the move, and it stays behind as a
-- pointer. Merging into something that has itself been merged follows the
-- pointer, and a merge that would loop is refused, so the pointers can never
-- form a cycle.

create function public.merge_venues(from_id uuid, into_id uuid, actor text) returns int
language plpgsql
as $$
declare
  target uuid;
  moved int;
begin
  if from_id = into_id then raise exception 'Pick a different venue to merge into.'; end if;
  select coalesce(merged_into, id) into target from public.venues where id = into_id;
  if target is null then raise exception 'That venue no longer exists.'; end if;
  if target = from_id then raise exception 'Those two are already merged the other way.'; end if;
  perform 1 from public.venues where id = from_id for update;
  if not found then raise exception 'That venue no longer exists.'; end if;

  insert into public.event_changes (event_id, actor, action, changes)
    select id, actor, 'edited', jsonb_build_object('venue_merged', jsonb_build_object('from', from_id, 'into', target))
    from public.events where venue_id = from_id;
  update public.events set venue_id = target where venue_id = from_id;
  get diagnostics moved = row_count;
  update public.venues set merged_into = target where merged_into = from_id;
  update public.venues set merged_into = target, verified = false where id = from_id;
  return moved;
end;
$$;

create function public.merge_organizations(from_id uuid, into_id uuid, actor text) returns int
language plpgsql
as $$
declare
  target uuid;
  moved int;
begin
  if from_id = into_id then raise exception 'Pick a different organization to merge into.'; end if;
  select coalesce(merged_into, id) into target from public.organizations where id = into_id;
  if target is null then raise exception 'That organization no longer exists.'; end if;
  if target = from_id then raise exception 'Those two are already merged the other way.'; end if;
  perform 1 from public.organizations where id = from_id for update;
  if not found then raise exception 'That organization no longer exists.'; end if;

  insert into public.event_changes (event_id, actor, action, changes)
    select id, actor, 'edited', jsonb_build_object('organization_merged', jsonb_build_object('from', from_id, 'into', target))
    from public.events where organization_id = from_id;
  update public.events set organization_id = target where organization_id = from_id;
  get diagnostics moved = row_count;
  update public.submissions set organization_id = target where organization_id = from_id;
  update public.organizations set merged_into = target where merged_into = from_id;
  update public.organizations set merged_into = target where id = from_id;
  return moved;
end;
$$;

-- Only the server (service role) may merge.
revoke execute on function public.merge_venues(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.merge_organizations(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.merge_venues(uuid, uuid, text) to service_role;
grant execute on function public.merge_organizations(uuid, uuid, text) to service_role;

-- ---------------------------------------------------------------------------
-- Row level security
-- ---------------------------------------------------------------------------

alter table public.event_types   enable row level security;
alter table public.causes        enable row level security;
alter table public.organizations enable row level security;
alter table public.venues        enable row level security;
alter table public.submissions   enable row level security;
alter table public.events        enable row level security;
alter table public.event_changes enable row level security;
alter table public.admins        enable row level security;
alter table public.holidays      enable row level security;

create policy "Public reads event types"   on public.event_types   for select using (true);
create policy "Public reads causes"        on public.causes        for select using (true);
-- An organization or venue becomes public with its first approved event (or,
-- for a venue, once an admin verifies it). A spam submission therefore
-- creates nothing anyone can see. Merged records stay readable so their old
-- addresses can redirect.
create policy "Public reads organizations with approved events" on public.organizations for select using (
  merged_into is not null
  or exists (select 1 from public.events e where e.organization_id = organizations.id and e.moderation = 'approved')
);
create policy "Public reads verified or used venues" on public.venues for select using (
  verified
  or merged_into is not null
  or exists (select 1 from public.events e where e.venue_id = venues.id and e.moderation = 'approved')
);
create policy "Public reads approved events" on public.events      for select using (moderation = 'approved');
create policy "Public reads holidays"      on public.holidays      for select using (true);
-- submissions, event_changes and admins: no policy, so no public access.

-- ---------------------------------------------------------------------------
-- Images
-- ---------------------------------------------------------------------------

-- Event flyers and photos. Public to read; uploaded only through signed
-- upload URLs the server issues (app/api/uploads).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('event-images', 'event-images', true, 5242880, array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do nothing;
