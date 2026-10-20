-- ---------------------------------------------------------------------------
-- Matching names the way the WordPress site did, and remembering the pairs
-- an admin has said are not the same place.
-- ---------------------------------------------------------------------------

-- public.name_key() gains four foldings: accents, "&" against the word "and",
-- a leading "the" and a trailing "Inc"/"Incorporated"/"LLC". It must keep
-- matching lib/names.ts nameKey() exactly, or the server and the generated
-- column will disagree about which record a typed name belongs to.
--
-- tests/names.test.ts covers the TypeScript side. The two were checked
-- against each other by running this function on a Postgres 17 and keying the
-- same 1,021 names (every venue and organizer in the WordPress export, plus
-- the awkward ones) with both: no disagreements. Worth repeating by hand if
-- either side changes, since the test suite has no database.
--
-- organizations.name_key and venues.name_key are generated columns over this
-- function, so they are dropped first and added back afterwards, which is
-- also what recomputes every stored key from the name it already holds.
--
-- The accents go without the unaccent extension, which is not immutable and
-- so cannot appear in a generated column: NFD splits each letter from its
-- mark and the marks are deleted. Both reductions take the leading and
-- trailing words off the list of words rather than off the joined string, so
-- "Theater Row" keeps the letters t, h, e that start it.

drop index if exists public.organizations_name_key;
drop index if exists public.venues_name_key;
alter table public.organizations drop column name_key;
alter table public.venues drop column name_key;

create or replace function public.name_key(value text) returns text
language sql immutable parallel safe
as $$
  select array_to_string(
           case
             when cardinality(w) > 1 and w[cardinality(w)] in ('inc', 'incorporated', 'llc')
               then w[1 : cardinality(w) - 1]
             else w
           end,
           ''
         )
  from (
    select case when cardinality(t) > 1 and t[1] = 'the' then t[2 : cardinality(t)] else t end as w
    from (
      select string_to_array(
               btrim(
                 regexp_replace(
                   replace(
                     lower(regexp_replace(normalize(coalesce(value, ''), nfd), '[̀-ͯ]', '', 'g')),
                     '&', ' and '
                   ),
                   '[^[:alnum:]]+', ' ', 'g'
                 )
               ),
               ' '
             ) as t
    ) split
  ) trimmed
$$;

alter table public.organizations add column name_key text generated always as (public.name_key(name)) stored;
alter table public.venues        add column name_key text generated always as (public.name_key(name)) stored;
create index organizations_name_key on public.organizations (name_key);
create index venues_name_key on public.venues (name_key);

-- ---------------------------------------------------------------------------
-- "Not the same"
-- ---------------------------------------------------------------------------

-- Two records similarNames() pairs up that an admin has looked at and kept
-- apart. Being here only keeps the pair off the duplicate lists and out of
-- the question on the review page; nothing about either record changes.
--
-- The pair is stored with the smaller id first so that one decision covers
-- it whichever way round it is asked about. The ids are not foreign keys
-- because which table they point at depends on kind; a decision about a
-- record that is later deleted is harmless and simply never matches again.

create type public.name_kind as enum ('venue', 'organization');

create table public.name_decisions (
  kind        public.name_kind not null,
  a_id        uuid not null,
  b_id        uuid not null,
  decided_by  text not null,
  decided_at  timestamptz not null default now(),
  primary key (kind, a_id, b_id),
  constraint name_decisions_sorted check (a_id < b_id)
);

-- No policy, so no public access. Only the server (service role) reads or
-- writes these, as with submissions and event_changes.
alter table public.name_decisions enable row level security;
