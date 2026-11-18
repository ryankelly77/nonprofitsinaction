-- ---------------------------------------------------------------------------
-- What it costs to attend
-- ---------------------------------------------------------------------------

-- The old Gravity Form asked only its virtual events about cost, and nothing
-- carried through the import, so every listing on the calendar is silent
-- about whether turning up costs anything. It is the second question anybody
-- asks after "where", and the one a search engine most wants answered: a
-- listing that can say "Free" gets a line in a result that a listing which
-- cannot say anything does not.
--
-- Cents, not dollars: money in a float is how $74.99 becomes $74.98999999.
--
-- Three states, which is why this is a nullable integer rather than a price
-- and a "free" flag:
--
--   null  nobody said. Every listing imported from WordPress, and anything
--         submitted before this existed.
--   0     free. Said out loud, and worth saying.
--   > 0   what it costs to get in.
--
-- price_max_cents is for tiered tickets, where $50 gets you a seat and $250
-- gets you the table. Null when there is one price.
alter table public.events
  add column price_cents     integer check (price_cents is null or (price_cents >= 0 and price_cents <= 100000000)),
  add column price_max_cents integer check (price_max_cents is null or (price_max_cents >= 0 and price_max_cents <= 100000000));

-- An upper bound with no lower bound is not a range, and a range that runs
-- backwards is a typo. Neither should reach a page.
alter table public.events
  add constraint events_price_range check (
    price_max_cents is null
    or (price_cents is not null and price_max_cents >= price_cents)
  );
