-- ────────────────────────────────────────────────── affiliate name parts
-- `display_name` was one free-text column holding a whole human name, so every
-- screen that wanted only the first name guessed at one. Overview split the
-- string on its first space at render time and hoped — see the comment it
-- carried: "Welcome back, Remco Michels reads like a form letter". Two real
-- columns end the guessing.
--
-- `display_name` stays, and stays NOT NULL. It is read by the profile menu, the
-- admin affiliate list, the viewing-as banner and the notification copy, and
-- rewriting every one of those to join two columns would be a large change for
-- no gain. What changes is where it comes from: it is composed from the parts
-- by the profile route on every save rather than typed directly.
--
-- Both parts are nullable. A `not null` here would have to be backfilled for
-- rows that genuinely have no second word — the six seeded 'reserved' rows
-- among them — and inventing a last name to satisfy a constraint is worse than
-- admitting there isn't one.

alter table public.affiliates
  -- 80 rather than 40 each, matching `display_name`'s own bound. A tighter
  -- limit would make the backfill below able to fail on a legitimately long
  -- single-word name, which is not a trade worth making for a text column.
  add column first_name text check (first_name is null or length(first_name) between 1 and 80),
  add column last_name  text check (last_name  is null or length(last_name)  between 1 and 80);

-- Backfill on the first space — the same rule Overview was already applying at
-- render time, so nobody's name changes shape on the way through.
--
-- A value with no space keeps all of itself as the first name and gets a null
-- last name. That is right for the seeded 'reserved' rows and right for anyone
-- who genuinely goes by one name.
--
-- Both `nullif`s are guards rather than logic: the outer one against a row
-- whose value has no space at all, and the empty-string ones against a stored
-- value with a leading space, which would otherwise write a "" that the length
-- check above rejects.
update public.affiliates
set first_name = nullif(split_part(display_name, ' ', 1), ''),
    last_name  = nullif(
                   nullif(
                     substring(display_name from position(' ' in display_name) + 1),
                     display_name
                   ),
                   ''
                 );
