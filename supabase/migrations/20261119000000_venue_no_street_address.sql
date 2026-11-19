-- ---------------------------------------------------------------------------
-- Places that have no street address, and never will
-- ---------------------------------------------------------------------------

-- The Historic Pearl, Hemisfair, Downtown San Antonio, the River Walk. Real
-- places everyone in the city can find, and none of them a door with a
-- number on it.
--
-- Until now the admin had two answers for a venue with no address, and both
-- were wrong for these: type one in, which means inventing a door, or retire
-- the venue, which means losing a place that events are genuinely held at.
-- So they sat on the list for ever, which is how a list of things to do
-- teaches people to stop reading it.
--
-- This is the third answer: somebody looked, there is no street address to
-- give, and the question is settled. Deliberately not a nullable flag, and
-- deliberately not folded into `verified`: that one says a person has read
-- the name, which is a different question with a different answer.
alter table public.venues
  add column no_street_address boolean not null default false;

-- A venue that does have an address cannot also be one that has none. The
-- flag is only ever an answer to an empty field.
alter table public.venues
  add constraint venues_no_street_address_is_empty check (
    not no_street_address or address_line1 is null or address_line1 = ''
  );
