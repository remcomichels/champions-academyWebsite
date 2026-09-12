-- The HeroFX IB feed, copied into our own database.
--
-- HeroFX exposes a read-only PostgreSQL feed of the IB structure beneath our
-- partner code: ten views in a `serving` schema, refreshed on a five-minute
-- cycle. We are given five concurrent connections in total, and their own
-- documentation is explicit that it must not be queried from a page request —
-- a traffic spike would exhaust the limit and start refusing, including
-- refusing our own background job.
--
-- So a cron job reads the views every few minutes and writes them here, and
-- the dashboard only ever reads these tables. That also means the dashboard
-- keeps working while their server is down, showing the last good copy.
--
-- ── What is deliberately not copied ─────────────────────────────────────────
-- Client email addresses, country names, and every figure that is arithmetic
-- over another one (net deposits, days to FTD, the whole `sub_ibs` view). The
-- feed exposes no phone numbers or identity documents at all.
--
-- Email is the interesting omission, because we do need it: an affiliate is
-- linked to their partner code by matching their login address against the
-- HeroFX client who owns that code. `email_fingerprint` is an HMAC of the
-- address with OTP_PEPPER, written only for clients who own a code, so the
-- match works and the addresses themselves are never stored.
--
-- ── Rules inherited from the feed ───────────────────────────────────────────
-- A client who leaves the structure disappears from every view there, their
-- past deposits included. `herofx_apply_snapshot` replaces these tables
-- wholesale on every run, so they disappear from here too. That is the
-- intended behaviour and not a bug to work around: their figures are not ours
-- to keep once they are not in the structure.
--
-- The two exceptions are `herofx_metrics_daily`, which the feed only holds for
-- about 35 days, and `herofx_status_changes`, which starts the day their feed
-- did. Those accumulate here instead of being replaced, because neither can be
-- backfilled later.

-- ─────────────────────────────────────────────────────── affiliates linkage
-- Which partner code an affiliate's dashboard reports on.
--
-- Unique: two affiliates claiming one code would each be shown the other's
-- downline, which is the one thing the whole visibility model exists to
-- prevent. Source is recorded because the two ways in differ in trust — an
-- email match is checked against the feed, an admin entry is somebody typing
-- — and because the sync must never overwrite a code set by hand.
alter table public.affiliates
  add column if not exists herofx_code text unique
    check (herofx_code is null or herofx_code ~ '^[A-Za-z0-9_-]{1,32}$'),
  add column if not exists herofx_code_source text
    check (herofx_code_source is null or herofx_code_source in ('email', 'admin')),
  add column if not exists herofx_linked_at timestamptz;

comment on column public.affiliates.herofx_code is
  'The HeroFX partner code this affiliate sees the downline of. Null until linked.';
comment on column public.affiliates.herofx_code_source is
  'email = matched automatically against the feed. admin = entered by hand.';

-- ──────────────────────────────────────────────────────────────── clients
-- One row per active client anywhere in our structure, from `serving.clients`.
--
-- `path_codes` is the chain of partner codes from our root down to whoever
-- referred them, and it is what every visibility rule here is built on:
-- `WHERE '<code>' = ANY(path_codes)` is an affiliate's whole downline and
-- nothing above them. A code never appears in the chain of anybody above it,
-- so there is no query shape that walks upwards.
create table if not exists public.herofx_clients (
  user_id bigint primary key,

  -- Null for a few minutes after somebody joins: the feed adds the membership
  -- row first and fills in the detail on the next poll. Membership is what
  -- decides who is visible, so a client with no name yet still counts.
  name text,
  registration_date timestamptz,
  status text,
  country_iso2 text,

  referrer_code text,
  -- Non-empty means this client is an IB themselves.
  own_codes text[] not null default '{}',
  path_codes text[] not null default '{}',

  live_balance_usd  numeric(18,2) not null default 0,
  deposits_usd      numeric(18,2) not null default 0,
  withdrawals_usd   numeric(18,2) not null default 0,

  ftd_date  timestamptz,
  last_seen timestamptz,

  -- HMAC-SHA256(OTP_PEPPER, 'herofx-email:' || lower(email)), and only for
  -- clients who own a partner code. The pepper lives in the environment, so a
  -- dump of this table cannot be searched back to an address even with a list
  -- of candidates.
  email_fingerprint text
);

create index if not exists herofx_clients_path_idx
  on public.herofx_clients using gin (path_codes);
create index if not exists herofx_clients_own_codes_idx
  on public.herofx_clients using gin (own_codes);
create index if not exists herofx_clients_referrer_idx
  on public.herofx_clients (referrer_code);
-- Partial: only code owners carry a fingerprint, and they are the only rows
-- the linking lookup ever probes.
create index if not exists herofx_clients_fingerprint_idx
  on public.herofx_clients (email_fingerprint)
  where email_fingerprint is not null;

-- ─────────────────────────────────────────────────────────────── payments
-- Completed deposits and withdrawals, from `serving.deposits` / `withdrawals`.
-- One table with a `kind`, because the two views have identical columns and
-- every figure over them is the same query with one value changed.
--
-- `payment_id` is unique within each view but the two are separate sequences,
-- so the key is the pair.
--
-- `created_at` is when the client *started* the payment, not when it settled —
-- the feed offers no completion time. A deposit begun on the 31st and
-- completed on the 1st therefore counts towards the earlier month, which is
-- what makes our monthly totals match the broker's own records.
--
-- `referrer_code` and `path_codes` are copied onto the payment rather than
-- joined from the client. They come that way in the view, and carrying them
-- means a range total over a branch is one indexed scan with no join.
create table if not exists public.herofx_payments (
  kind       text   not null check (kind in ('deposit', 'withdrawal')),
  payment_id bigint not null,
  user_id    bigint,

  referrer_code text,
  path_codes    text[] not null default '{}',

  -- CryptoNow or NFG; the feed counts no other payment system as money.
  psp        text,
  amount_usd numeric(18,2) not null default 0,
  created_at timestamptz   not null,

  primary key (kind, payment_id)
);

create index if not exists herofx_payments_path_idx
  on public.herofx_payments using gin (path_codes);
create index if not exists herofx_payments_kind_time_idx
  on public.herofx_payments (kind, created_at desc);

-- ──────────────────────────────────────────────────────────── commissions
-- What each partner code earned, per day, from `serving.commissions_daily`.
-- Only the daily view is copied: weekly and monthly are sums of the same rows,
-- and two copies of one fact is two things to disagree.
--
-- Amounts are signed. A negative row is a clawback reversing an earlier
-- accrual, and summing normally is what gives the right answer — filtering
-- negatives out would overstate earnings.
--
-- A surrogate key rather than (code, period, program, status): nothing in the
-- feed's documentation promises that combination is unique, and a sync that
-- fails on a duplicate would take the whole copy down for a figure nobody
-- keys on. The table is replaced wholesale each run anyway.
create table if not exists public.herofx_commissions_daily (
  id bigserial primary key,
  code   text not null,
  period date not null,
  program text,
  status  text,
  calculated_usd numeric(18,2) not null default 0,
  available_usd  numeric(18,2) not null default 0
);

create index if not exists herofx_commissions_code_period_idx
  on public.herofx_commissions_daily (code, period desc);

-- ────────────────────────────────────────────────────────── daily metrics
-- The broker's own funnel figures per code, from `serving.metrics_daily`.
--
-- Accumulated, not replaced: the feed holds roughly the last 35 days and
-- drops the rest, so anything not kept here is gone for good. Recent days are
-- restated for a while after they close, which is why the upsert overwrites
-- rather than ignoring a day it already has.
--
-- These are the broker's numbers on the broker's basis and will not tie out
-- against `herofx_payments`, which is built from payment records. Use these
-- for funnel shape — registrations, accounts opened, KYC — and the payment
-- tables for money.
create table if not exists public.herofx_metrics_daily (
  code text not null,
  day  date not null,
  joined_users    integer not null default 0,
  real_accounts   integer not null default 0,
  demo_accounts   integer not null default 0,
  deposited_users integer not null default 0,
  deposits_usd    numeric(18,2) not null default 0,
  withdrawals_usd numeric(18,2) not null default 0,
  traded_volume   numeric(24,4) not null default 0,
  kyc_verified    integer not null default 0,
  primary key (code, day)
);

-- ─────────────────────────────────────────────────────── status changes
-- KYC and account status history, from `serving.status_changes`.
--
-- Accumulated for the same reason as the metrics: the feed's own history
-- starts the day it was switched on and is never backfilled.
--
-- Rows for clients who have left the structure are deleted on the next sync.
-- Keeping a status history for somebody we can no longer see would be keeping
-- exactly the personal data the rest of this design avoids.
create table if not exists public.herofx_status_changes (
  user_id    bigint      not null,
  old_status text,
  new_status text        not null default '',
  changed_at timestamptz not null,
  primary key (user_id, changed_at, new_status)
);

-- ───────────────────────────────────────────────────────────── freshness
-- The feed's own account of whether it is up to date, from
-- `serving.data_freshness`. `status` is fresh / lagging / stale / never, and
-- the dashboard says so rather than presenting a stale figure as current.
create table if not exists public.herofx_freshness (
  job                   text primary key,
  last_success_at       timestamptz,
  status                text,
  cadence_seconds       integer,
  seconds_since_success bigint
);

-- ──────────────────────────────────────────────────────────── sync state
-- One row, describing our own last run. `id` is a boolean pinned true, which
-- is the cheapest way to make a table that cannot hold a second row.
--
-- The failure is recorded as well as the success: a dashboard that has quietly
-- been showing four-hour-old figures because the sync has been failing all
-- morning is worse than one that says so.
create table if not exists public.herofx_sync_state (
  id boolean primary key default true check (id),
  last_attempt_at timestamptz,
  last_success_at timestamptz,
  last_error      text,
  client_count    integer not null default 0,
  payment_count   integer not null default 0
);

insert into public.herofx_sync_state (id) values (true) on conflict (id) do nothing;

-- ──────────────────────────────────────────────────────────────── lockdown
-- None of this is reachable from a browser. The dashboard reads it through
-- /api/affiliate/* with the secret key, scoped to the caller's own code, the
-- same way every other figure on the dashboard is served.
revoke all on public.herofx_clients,
              public.herofx_payments,
              public.herofx_commissions_daily,
              public.herofx_metrics_daily,
              public.herofx_status_changes,
              public.herofx_freshness,
              public.herofx_sync_state
  from anon, authenticated;

revoke all on sequence public.herofx_commissions_daily_id_seq from anon, authenticated;

alter table public.herofx_clients           enable row level security;
alter table public.herofx_clients           force  row level security;
alter table public.herofx_payments          enable row level security;
alter table public.herofx_payments          force  row level security;
alter table public.herofx_commissions_daily enable row level security;
alter table public.herofx_commissions_daily force  row level security;
alter table public.herofx_metrics_daily     enable row level security;
alter table public.herofx_metrics_daily     force  row level security;
alter table public.herofx_status_changes    enable row level security;
alter table public.herofx_status_changes    force  row level security;
alter table public.herofx_freshness         enable row level security;
alter table public.herofx_freshness         force  row level security;
alter table public.herofx_sync_state        enable row level security;
alter table public.herofx_sync_state        force  row level security;

-- No policies, deliberately. There is no role that should reach these tables
-- through PostgREST; the only reader is the server, whose secret key bypasses
-- RLS. RLS is enabled anyway so that a future grant cannot quietly open them.

-- ──────────────────────────────────────────────────── apply one snapshot
-- Everything the sync writes, in one statement and therefore one transaction.
--
-- This is why it is a function rather than a series of PostgREST calls: the
-- copy is replaced wholesale, and a job that died between "delete the clients"
-- and "insert the clients" would leave every affiliate looking at an empty
-- dashboard. Here a failure rolls the whole thing back and the last good copy
-- stays up.
--
-- The payloads are the feed's rows as JSON. `jsonb_to_recordset` feeds each
-- JSON string through the column type's own input function, which is what lets
-- the numerics and bigints arrive as strings — node-postgres returns them that
-- way on purpose, to avoid rounding them through a float.
create or replace function public.herofx_apply_snapshot(
  p_clients        jsonb,
  p_payments       jsonb,
  p_commissions    jsonb,
  p_metrics        jsonb,
  p_status_changes jsonb,
  p_freshness      jsonb
)
returns jsonb
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_clients  integer := 0;
  v_payments integer := 0;
  v_pruned   integer := 0;
begin
  -- ── clients ──────────────────────────────────────────────────────────────
  delete from public.herofx_clients;

  insert into public.herofx_clients (
    user_id, name, registration_date, status, country_iso2,
    referrer_code, own_codes, path_codes,
    live_balance_usd, deposits_usd, withdrawals_usd,
    ftd_date, last_seen, email_fingerprint
  )
  select
    x.user_id, x.name, x.registration_date, x.status, x.country_iso2,
    x.referrer_code,
    coalesce(x.own_codes,  '{}'),
    coalesce(x.path_codes, '{}'),
    coalesce(x.live_balance_usd, 0),
    coalesce(x.deposits_usd,     0),
    coalesce(x.withdrawals_usd,  0),
    x.ftd_date, x.last_seen, x.email_fingerprint
  from jsonb_to_recordset(coalesce(p_clients, '[]'::jsonb)) as x(
    user_id bigint, name text, registration_date timestamptz, status text,
    country_iso2 text, referrer_code text, own_codes text[], path_codes text[],
    live_balance_usd numeric, deposits_usd numeric, withdrawals_usd numeric,
    ftd_date timestamptz, last_seen timestamptz, email_fingerprint text
  );

  get diagnostics v_clients = row_count;

  -- ── payments ─────────────────────────────────────────────────────────────
  delete from public.herofx_payments;

  insert into public.herofx_payments (
    kind, payment_id, user_id, referrer_code, path_codes, psp, amount_usd, created_at
  )
  select
    x.kind, x.payment_id, x.user_id, x.referrer_code,
    coalesce(x.path_codes, '{}'),
    x.psp,
    coalesce(x.amount_usd, 0),
    x.created_at
  from jsonb_to_recordset(coalesce(p_payments, '[]'::jsonb)) as x(
    kind text, payment_id bigint, user_id bigint, referrer_code text,
    path_codes text[], psp text, amount_usd numeric, created_at timestamptz
  );

  get diagnostics v_payments = row_count;

  -- ── commissions ──────────────────────────────────────────────────────────
  delete from public.herofx_commissions_daily;

  insert into public.herofx_commissions_daily (
    code, period, program, status, calculated_usd, available_usd
  )
  select
    x.code, x.period, x.program, x.status,
    coalesce(x.calculated_usd, 0),
    coalesce(x.available_usd,  0)
  from jsonb_to_recordset(coalesce(p_commissions, '[]'::jsonb)) as x(
    code text, period date, program text, status text,
    calculated_usd numeric, available_usd numeric
  )
  where x.code is not null and x.period is not null;

  -- ── daily metrics: accumulated, restated days overwritten ────────────────
  insert into public.herofx_metrics_daily (
    code, day, joined_users, real_accounts, demo_accounts, deposited_users,
    deposits_usd, withdrawals_usd, traded_volume, kyc_verified
  )
  select
    x.code, x.day,
    coalesce(x.joined_users,    0),
    coalesce(x.real_accounts,   0),
    coalesce(x.demo_accounts,   0),
    coalesce(x.deposited_users, 0),
    coalesce(x.deposits_usd,    0),
    coalesce(x.withdrawals_usd, 0),
    coalesce(x.traded_volume,   0),
    coalesce(x.kyc_verified,    0)
  from jsonb_to_recordset(coalesce(p_metrics, '[]'::jsonb)) as x(
    code text, day date, joined_users integer, real_accounts integer,
    demo_accounts integer, deposited_users integer, deposits_usd numeric,
    withdrawals_usd numeric, traded_volume numeric, kyc_verified integer
  )
  where x.code is not null and x.day is not null
  on conflict (code, day) do update set
    joined_users    = excluded.joined_users,
    real_accounts   = excluded.real_accounts,
    demo_accounts   = excluded.demo_accounts,
    deposited_users = excluded.deposited_users,
    deposits_usd    = excluded.deposits_usd,
    withdrawals_usd = excluded.withdrawals_usd,
    traded_volume   = excluded.traded_volume,
    kyc_verified    = excluded.kyc_verified;

  -- ── status changes: accumulated, then pruned to current members ──────────
  insert into public.herofx_status_changes (user_id, old_status, new_status, changed_at)
  select x.user_id, x.old_status, coalesce(x.new_status, ''), x.changed_at
  from jsonb_to_recordset(coalesce(p_status_changes, '[]'::jsonb)) as x(
    user_id bigint, old_status text, new_status text, changed_at timestamptz
  )
  where x.user_id is not null and x.changed_at is not null
  on conflict (user_id, changed_at, new_status) do nothing;

  delete from public.herofx_status_changes s
   where not exists (
     select 1 from public.herofx_clients c where c.user_id = s.user_id
   );

  get diagnostics v_pruned = row_count;

  -- ── freshness ────────────────────────────────────────────────────────────
  delete from public.herofx_freshness;

  insert into public.herofx_freshness (
    job, last_success_at, status, cadence_seconds, seconds_since_success
  )
  select x.job, x.last_success_at, x.status, x.cadence_seconds, x.seconds_since_success
  from jsonb_to_recordset(coalesce(p_freshness, '[]'::jsonb)) as x(
    job text, last_success_at timestamptz, status text,
    cadence_seconds integer, seconds_since_success bigint
  )
  where x.job is not null;

  -- ── our own state ────────────────────────────────────────────────────────
  update public.herofx_sync_state
     set last_attempt_at = now(),
         last_success_at = now(),
         last_error      = null,
         client_count    = v_clients,
         payment_count   = v_payments
   where id;

  return jsonb_build_object(
    'clients',  v_clients,
    'payments', v_payments,
    'pruned_status_changes', v_pruned
  );
end;
$$;

-- ───────────────────────────────────────────────── one affiliate's figures
-- The five headline numbers for one partner code, over one window.
--
-- Everything is network-wide: a code's own clients and everybody beneath it,
-- which is what `= ANY(path_codes)` gives in a single condition. An affiliate
-- sees their whole downline and nothing above it.
--
-- `p_since` null means all time. The window is half-open — `>= since` and
-- `< until` — so two adjacent ranges never both contain the same payment.
create or replace function public.herofx_network_figures(
  p_code  text,
  p_since timestamptz default null,
  p_until timestamptz default now()
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with branch as (
    select * from public.herofx_clients where p_code = any(path_codes)
  ),
  payments as (
    select kind, amount_usd, created_at
    from public.herofx_payments
    where p_code = any(path_codes)
      and created_at < p_until
      and (p_since is null or created_at >= p_since)
  )
  select jsonb_build_object(
    -- New sign-ups anywhere in the network during the window.
    'registered', (
      select count(*)::int from branch
      where registration_date < p_until
        and (p_since is null or registration_date >= p_since)),

    -- People whose *first* completed deposit landed in the window. Counted on
    -- ftd_date rather than on the payments, so somebody who deposits twice in
    -- a week is one depositor, not two.
    'deposited', (
      select count(*)::int from branch
      where ftd_date is not null
        and ftd_date < p_until
        and (p_since is null or ftd_date >= p_since)),

    'deposits_usd',    (select coalesce(sum(amount_usd), 0) from payments where kind = 'deposit'),
    'withdrawals_usd', (select coalesce(sum(amount_usd), 0) from payments where kind = 'withdrawal'),

    -- Current totals, deliberately not windowed: "how big is my network" is a
    -- standing figure, and a 7-day version of it would only ever mean "who
    -- joined this week", which is `registered` above.
    'network_clients', (select count(*)::int from branch),
    'sub_ibs',         (select count(*)::int from branch where cardinality(own_codes) > 0),
    'balance_usd',     (select coalesce(sum(live_balance_usd), 0) from branch),

    -- What this code itself earned in the window. A sub-IB's own commission is
    -- theirs, not this affiliate's, so this is not summed over the branch.
    'commission_usd', (
      select coalesce(sum(calculated_usd), 0)
      from public.herofx_commissions_daily
      where code = p_code
        and period < p_until::date
        and (p_since is null or period >= p_since::date))
  );
$$;

-- ──────────────────────────────────────────── the sub-IBs below one code
-- One row per partner code in the affiliate's downline, with the size of each
-- branch. At fifty IBs and a thousand clients, this is the table that answers
-- "who is actually producing" — the client list cannot.
--
-- The codes come from `own_codes` on the clients in the branch, so a sub-IB
-- appears here because they are in the downline, never because they merely
-- have a code. The affiliate's own code is excluded: they are not their own
-- sub-IB.
create or replace function public.herofx_sub_ibs(
  p_code  text,
  p_since timestamptz default null,
  p_until timestamptz default now()
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with branch as (
    select * from public.herofx_clients where p_code = any(path_codes)
  ),
  codes as (
    select distinct c.code, b.name as owner_name, b.user_id as owner_user_id
    from branch b, unnest(b.own_codes) as c(code)
    where c.code <> p_code
  ),
  rows_out as (
    select
      k.code,
      k.owner_name,
      k.owner_user_id,
      (select count(*)::int from public.herofx_clients x where x.referrer_code = k.code) as direct_clients,
      (select count(*)::int from public.herofx_clients x where k.code = any(x.path_codes)) as network_clients,
      (select coalesce(sum(p.amount_usd), 0)
         from public.herofx_payments p
        where p.kind = 'deposit'
          and k.code = any(p.path_codes)
          and p.created_at < p_until
          and (p_since is null or p.created_at >= p_since)) as deposits_usd,
      (select coalesce(sum(d.calculated_usd), 0)
         from public.herofx_commissions_daily d
        where d.code = k.code
          and d.period < p_until::date
          and (p_since is null or d.period >= p_since::date)) as commission_usd
    from codes k
  )
  select coalesce(
    jsonb_agg(
      jsonb_build_object(
        'code', code,
        'owner_name', owner_name,
        'owner_user_id', owner_user_id,
        'direct_clients', direct_clients,
        'network_clients', network_clients,
        'deposits_usd', deposits_usd,
        'commission_usd', commission_usd
      )
      order by network_clients desc, deposits_usd desc
    ),
    '[]'::jsonb
  )
  from rows_out;
$$;

-- ──────────────────────────────────────────────────────── function grants
-- Same treatment as every other function here, and for the reason migration
-- 20260808135418 spells out: Postgres grants EXECUTE to PUBLIC by default and
-- anon/authenticated inherit from it. `herofx_apply_snapshot` in particular
-- would let anyone holding the publishable key wipe the copy.
revoke all on function public.herofx_apply_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  from public, anon, authenticated;
revoke all on function public.herofx_network_figures(text, timestamptz, timestamptz)
  from public, anon, authenticated;
revoke all on function public.herofx_sub_ibs(text, timestamptz, timestamptz)
  from public, anon, authenticated;

grant execute on function public.herofx_apply_snapshot(jsonb, jsonb, jsonb, jsonb, jsonb, jsonb)
  to service_role;
grant execute on function public.herofx_network_figures(text, timestamptz, timestamptz)
  to service_role;
grant execute on function public.herofx_sub_ibs(text, timestamptz, timestamptz)
  to service_role;
