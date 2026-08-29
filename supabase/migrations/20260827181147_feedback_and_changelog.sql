-- Feedback from the dashboard, and the changelog it gets read alongside.
--
-- Two tables in one migration because they are the same shape of thing — short
-- admin-owned text, written from one place and read from another — and neither
-- is big enough to be worth its own file.
--
-- ── feedback ────────────────────────────────────────────────────────────────
-- The suggestion box behind the top bar's speech bubble. Deliberately one-way:
-- there is no thread, no status and no reply column, because the product does
-- not promise one. If that changes, a `handled_at` here is the smallest
-- possible next step and nothing above depends on its absence.
create table public.feedback (
  id           bigserial primary key,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  created_at   timestamptz not null default now(),

  kind text not null check (kind in ('issue', 'idea')),

  -- Capped in the database as well as the textarea. The client limit is a
  -- courtesy; this is the one that holds when someone posts to the endpoint
  -- directly.
  body text not null check (char_length(body) between 3 and 2000)
);

-- The admin inbox reads newest-first, filtered by kind. One index covers both:
-- the filter is an equality and the sort is the trailing column.
create index feedback_kind_time_idx
  on public.feedback (kind, created_at desc);

create index feedback_affiliate_idx
  on public.feedback (affiliate_id);

-- ── changelog ───────────────────────────────────────────────────────────────
-- Release notes, written from the admin dashboard and read by affiliates from
-- the profile menu.
--
-- `published_at` null means a draft: written but not shown. That is the only
-- state this needs — an entry is either visible or it is not, and a workflow
-- with more steps than that would be a content management system, which is not
-- what a changelog is.
create table public.changelog (
  id           bigserial primary key,
  created_at   timestamptz not null default now(),
  published_at timestamptz,

  title text not null check (char_length(title) between 1 and 140),
  body  text not null check (char_length(body) between 1 and 8000)
);

-- Published entries, newest first — the only query the affiliate-facing page
-- makes. Partial, so drafts stay out of the index entirely.
create index changelog_published_idx
  on public.changelog (published_at desc)
  where published_at is not null;

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Both tables are locked down with no policies at all, which is the deny-all
-- default: every read and write here goes through our own server with the
-- secret key, which bypasses RLS. Nothing in the browser talks to Supabase in
-- this project, so there is no anon or authenticated role to grant to.
--
-- Stated explicitly rather than left to the loop in 20260808000003_rls.sql,
-- because that migration enumerated the tables that existed when it ran and
-- these two did not.
alter table public.feedback  enable row level security;
alter table public.changelog enable row level security;

-- Belt and braces: even with RLS on, an absent grant means the browser roles
-- cannot reach these relations to be refused by a policy in the first place.
revoke all on public.feedback  from anon, authenticated;
revoke all on public.changelog from anon, authenticated;
