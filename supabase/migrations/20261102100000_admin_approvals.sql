-- ---------------------------------------------------------------------------
-- What the person reviewing listings needs
-- ---------------------------------------------------------------------------

-- Three things: organizations she trusts enough to publish without reading
-- every time, a way to retire a record that should stop being offered without
-- breaking the pages that already point at it, and her own wording for
-- turning a listing down.

-- ---------------------------------------------------------------------------
-- Organizations she trusts
-- ---------------------------------------------------------------------------

-- An event from one of these goes on the calendar as it arrives, with one
-- exception, enforced in lib/moderation.ts: if it brings in a venue or an
-- organization name nobody has read yet, it waits for review like any other.
-- Trust is in the organization, not in a name that has never been seen, and
-- publishing an unread name is what turns one typo into a second record.
alter table public.organizations add column auto_approve boolean not null default false;

-- ---------------------------------------------------------------------------
-- Retiring rather than deleting
-- ---------------------------------------------------------------------------

-- Retired means: gone from the pickers, the filters and the admin lists, but
-- still attached to every event that already names it, so nothing a visitor
-- has bookmarked breaks and no event loses its venue. A record with no events
-- at all is deleted outright instead; the admin decides which happens by
-- whether anything points at it.
--
-- This is deliberately not merged_into. Merging says "this was always the
-- same place as that one" and moves the events; retiring says "do not offer
-- this again" and moves nothing.
alter table public.organizations add column retired boolean not null default false;
alter table public.venues        add column retired boolean not null default false;

-- Causes gain what event types already had, so a cause can be taken off the
-- form without taking it off the organizations already filed under it.
alter table public.causes add column active boolean not null default true;

create index organizations_live on public.organizations (name) where not retired and merged_into is null;
create index venues_live        on public.venues (name)        where not retired and merged_into is null;

-- ---------------------------------------------------------------------------
-- Her words for turning a listing down
-- ---------------------------------------------------------------------------

-- Picked from a list and then editable before it is sent, so the common
-- answers are one click and an unusual one is still possible. Kept in the
-- database rather than the code because the wording is hers: she will want to
-- soften a sentence the week after reading it back in a reply.
create table public.rejection_reasons (
  id          uuid primary key default gen_random_uuid(),
  label       text not null,
  body        text not null,
  sort        int  not null default 0,
  active      boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger rejection_reasons_touch before update on public.rejection_reasons
  for each row execute function public.touch_updated_at();

-- A starting set, written to be sent as they are. Every one of them says what
-- would make the listing work, because a rejection that does not is a dead
-- end for someone who meant well.
insert into public.rejection_reasons (label, body, sort) values
  (
    'Not a nonprofit event',
    'Thanks for sending this over. This calendar lists events from San Antonio nonprofits, and this one looks like it falls outside that, so we have not added it. If we have that wrong, reply and tell us a little about the organization behind it and we will take another look.',
    10
  ),
  (
    'Already listed',
    'Thanks for sending this over. This event is already on the calendar, so we have not added it a second time. If the listing that is up needs changing, use the private edit link in the confirmation email for it, or ask us at /manage/ for a new link.',
    20
  ),
  (
    'Not enough detail',
    'Thanks for sending this over. We need a little more before we can list it: a venue with a street address, a start and end time, and a sentence or two about what the event is. Send those and we will get it up.',
    30
  ),
  (
    'Date or time looks wrong',
    'Thanks for sending this over. The date or time on this one does not look right to us, so we have held it rather than publish something that would send people on the wrong day. Confirm the details and we will list it.',
    40
  ),
  (
    'Past event',
    'Thanks for sending this over. This event has already happened, so we have not added it. If you meant a later date, send it again with the right one.',
    50
  );

-- No policy, so no public access: these are internal wording, read and
-- written by the server alone, like submissions and event_changes.
alter table public.rejection_reasons enable row level security;
