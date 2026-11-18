-- ---------------------------------------------------------------------------
-- The colour of an event type becomes hers to choose, from a fixed set
-- ---------------------------------------------------------------------------

-- Until now the twelve colours were written into the stylesheet against the
-- twelve slugs the import created, so a kind of event added in the admin came
-- out with no colour at all and fell back to amber, which means "something is
-- on this date" everywhere else on the calendar.
--
-- The colour moves onto the row and is picked from a list. The list is fixed
-- on purpose: the twelve were chosen by measuring, not by eye, so that no two
-- read as the same colour and none is mistaken for the Canceled red or the
-- brand teal. A free colour picker would undo that within a month. The check
-- constraint is what keeps it fixed, since it is the only thing a stray
-- update has to get past.
alter table public.event_types
  add column color text not null default 'grey'
  check (color in ('sand','citron','moss','green','mint','sky','blue','violet','orchid','blossom','rose','grey'));

-- Each existing type keeps exactly the colour it already had, so nothing on
-- the public calendar changes the day this runs.
update public.event_types set color = case slug
  when 'luncheon'       then 'sand'
  when 'breakfast'      then 'citron'
  when 'community'      then 'moss'
  when 'run-walk'       then 'green'
  when 'golf'           then 'mint'
  when 'sporting-event' then 'sky'
  when 'conference'     then 'blue'
  when 'gala'           then 'violet'
  when 'dinner'         then 'orchid'
  when 'concert'        then 'blossom'
  when 'festival'       then 'rose'
  else 'grey'
end;
