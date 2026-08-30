-- Why somebody left, and the columns the purge needs to be idempotent.
--
-- Both halves of one change: the request now carries a reason, and it is now
-- actually carried out rather than sitting in a queue nobody drains.

-- ── The reason ──────────────────────────────────────────────────────────────
-- Two columns rather than one free-text box. The picked reason is a short
-- stable key, so a year of them can be counted; the note is whatever they chose
-- to add, which cannot be. Collapsing them into one string would make the first
-- question unanswerable without parsing prose.
alter table public.gdpr_requests
  -- Null for the requests made before this existed, and for anything that is
  -- not a deletion. Deliberately not constrained to a list: the set of reasons
  -- is a product decision that will change, and a check constraint here would
  -- turn "add an option to a dropdown" into a migration.
  add column reason text,
  -- Free text, capped. Long enough for a real sentence, short enough that the
  -- column cannot become somewhere to paste an essay.
  add column reason_note text,
  add constraint gdpr_requests_reason_note_len check (char_length(reason_note) <= 500);

-- ── The purge ───────────────────────────────────────────────────────────────
-- `completed_at` already exists and was never written to. The job now sets it,
-- and this index is what the job reads: pending deletions whose grace period
-- has run out. Partial, because that is a handful of rows against a table that
-- otherwise only grows.
create index gdpr_requests_due_idx
  on public.gdpr_requests (execute_after)
  where kind = 'delete' and status in ('pending', 'ready');

-- No new table for the erased account, and no archive of what was removed.
-- Anonymising in place is the point: the affiliate row survives with every
-- personal field blanked so `conversions` keep pointing somewhere valid — the
-- programme's own analytics aggregate them, so deleting an affiliate's sales
-- would quietly rewrite historical totals for everyone else. Keeping a copy of
-- what was erased, meanwhile, would mean answering an erasure request by
-- filing the data somewhere else.
