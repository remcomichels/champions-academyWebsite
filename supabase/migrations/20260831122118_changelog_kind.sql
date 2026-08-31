-- What kind of change an entry describes.
--
-- The changelog moves out of the dashboard and onto a public /changelog page,
-- where the reader has no context for an entry beyond what it says about
-- itself. A date and a title do not distinguish "we added something" from "we
-- broke something you depend on", and that is the distinction a changelog
-- exists to make, so it becomes a column rather than a convention in the title.
--
-- Closed set, enforced here as well as at the endpoint. The slugs are what
-- every row stores from now on and are therefore permanent — the display
-- wording lives in shared/types/changelog.ts and can change without a
-- migration.
alter table public.changelog
  add column kind text not null default 'improvement'
    check (kind in ('feature', 'improvement', 'fix', 'breaking'));

-- The default exists to backfill the rows written before this column did, and
-- 'improvement' is the honest reading of them: they predate the distinction, so
-- claiming any of them was a new feature or a breaking change would be putting
-- words in their author's mouth.
--
-- Dropped immediately after, so the choice is made deliberately on every entry
-- written from here on. An insert that forgets `kind` should fail loudly rather
-- than quietly file itself under the most forgettable of the four.
alter table public.changelog
  alter column kind drop default;
