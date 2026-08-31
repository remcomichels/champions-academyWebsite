-- Removing Whop.
--
-- The VIP tier is no longer sold through Whop — everything now goes through
-- Telegram, which sells nothing and therefore produces no payment to attribute.
-- That takes the whole sales half of this schema with it: there is no payment
-- event to receive, no checkout configuration to point anyone at, and no
-- commission for the dashboard to report on.
--
-- What survives untouched is the referral machinery itself — slugs, visits,
-- clicks and the traffic analytics over them. Affiliates still have links and
-- those links are still measured; only "and then they bought something" goes.
--
-- Signups through a broker's IB link will be tracked later against that
-- broker's API. Deliberately NOT reusing `conversions` for it: a Whop payment
-- and a broker registration share a shape only by coincidence — different
-- identifier, different lifecycle, different provider — and a table whose
-- columns are named for the system that no longer feeds it is how the next
-- person ends up debugging `whop_payment_id` in 2027. That gets its own
-- migration, with its own names, when the API is in hand.

-- ── The attribution tables ──────────────────────────────────────────────────
-- Both are dropped rather than emptied. Dropping takes their indexes and their
-- RLS policies (migration 20260808135308) with them, so nothing is left behind
-- referring to a table that no longer exists.
--
-- `conversions` was written only by the Whop webhook, and `whop_stats_cache`
-- was the stale-while-error store for a Whop stats call that was never built —
-- nothing but purgeAffiliate ever named it.
drop table if exists public.conversions;
drop table if exists public.whop_stats_cache;

-- ── The affiliate's Whop linkage ────────────────────────────────────────────
-- `vip_checkout_url` goes with the rest of them. It is a whop.com URL by CHECK
-- constraint, so it cannot outlive Whop as a generic field — the Telegram and
-- Calendly columns beside it are the two that remain.
alter table public.affiliates
  drop column if exists whop_affiliate_id,
  drop column if exists whop_username,
  drop column if exists whop_checkout_configuration_id,
  drop column if exists vip_checkout_url;

-- ── The `vip` click role ────────────────────────────────────────────────────
-- Two roles left. Existing rows are deleted first: the constraint is validated
-- against the whole table, so a single surviving 'vip' row would fail the ALTER
-- rather than the rows being quietly grandfathered in.
--
-- Deleting them is the honest option anyway. A vip click was a click on a
-- checkout that no longer exists, and leaving them in would keep them in every
-- click total on the Analytics tab while the role itself renders as nothing.
delete from public.referral_clicks where role = 'vip';

alter table public.referral_clicks
  drop constraint if exists referral_clicks_role_check;

alter table public.referral_clicks
  add constraint referral_clicks_role_check check (role in ('lite', 'calendly'));

-- ── affiliate_sales() ───────────────────────────────────────────────────────
-- The Sales tab's RPC. Nothing else called it, and the tab is gone.
drop function if exists public.affiliate_sales(uuid, timestamptz, timestamptz, text);

-- ── program_analytics(), without sales ──────────────────────────────────────
-- Recreated rather than left to break: it reads `public.conversions` directly,
-- so it would fail at call time the moment the table above disappeared — and
-- the admin Analytics tab is its only caller.
--
-- Everything that was counted over visits and clicks is unchanged. What comes
-- out is the `s` CTE and the four figures built on it (`sales`,
-- `affiliates_selling`, the per-day sales series, and the sales column on the
-- leaderboard).
--
-- The leaderboard's ordering changes as a consequence. It ranked on sales and
-- used visits only to break ties; with sales gone it ranks on visits and breaks
-- ties on clicks, which is the same idea one rung down the funnel — who is
-- sending traffic, and of that traffic who is getting people to act.
create or replace function public.program_analytics(
  p_since    timestamptz,
  p_until    timestamptz default now(),
  p_timezone text default 'UTC',
  p_leaders  int default 10
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with v as (
    select affiliate_id, occurred_at, referrer_host, country
    from public.referral_visits
    where occurred_at >= p_since and occurred_at < p_until
  ),
  c as (
    select affiliate_id, occurred_at, role
    from public.referral_clicks
    where occurred_at >= p_since and occurred_at < p_until
  ),

  -- Every day in the window, so a day with no traffic plots as a zero instead
  -- of being missing and letting the chart join across the gap.
  days as (
    select generate_series(
      (p_since at time zone p_timezone)::date,
      ((p_until at time zone p_timezone) - interval '1 microsecond')::date,
      interval '1 day'
    )::date as day
  ),
  v_day as (
    select (occurred_at at time zone p_timezone)::date as day, count(*)::int as n
    from v group by 1
  ),
  c_day as (
    select (occurred_at at time zone p_timezone)::date as day, count(*)::int as n
    from c group by 1
  ),

  src as (
    select referrer_host as host, count(*)::int as visits
    from v group by 1 order by 2 desc limit 12
  ),
  ctry as (
    select country, count(*)::int as visits
    from v group by 1 order by 2 desc limit 12
  ),
  roles as (
    select role, count(*)::int as clicks from c group by 1 order by 2 desc
  ),

  -- Ranked on visits, then clicks to separate everyone still on zero. Revoked
  -- affiliates are included: their traffic happened, and dropping them would
  -- make the leaderboard disagree with the totals above it.
  leaders as (
    select a.id, a.slug, a.display_name, a.status,
           coalesce(lv.n, 0) as visits,
           coalesce(lc.n, 0) as clicks
    from public.affiliates a
    left join (select affiliate_id, count(*)::int n from v group by 1) lv on lv.affiliate_id = a.id
    left join (select affiliate_id, count(*)::int n from c group by 1) lc on lc.affiliate_id = a.id
    -- Reserved slugs are seeded as revoked rows with no traffic and would
    -- otherwise pad the tail of the board.
    where coalesce(lv.n, 0) + coalesce(lc.n, 0) > 0
    order by visits desc, clicks desc
    limit p_leaders
  )

  select jsonb_build_object(
    'visits', (select count(*)::int from v),
    'clicks', (select count(*)::int from c),
    'country_count', (select count(distinct country)::int from v where country is not null),
    -- "Sending traffic" is a different question from "exists": an affiliate who
    -- has never been sent a code still counts in the total.
    'affiliates_total',  (select count(*)::int from public.affiliates where status = 'active'),
    'affiliates_active', (select count(distinct affiliate_id)::int from v),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'visits', coalesce(vd.n, 0),
        'clicks', coalesce(cd.n, 0)
      ) order by d.day), '[]'::jsonb)
      from days d
      left join v_day vd on vd.day = d.day
      left join c_day cd on cd.day = d.day
    ),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('host', host, 'visits', visits)
             order by visits desc), '[]'::jsonb) from src),
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('country', country, 'visits', visits)
             order by visits desc), '[]'::jsonb) from ctry),
    'clicks_by_role', (
      select coalesce(jsonb_agg(jsonb_build_object('role', role, 'clicks', clicks)
             order by clicks desc), '[]'::jsonb) from roles),
    'leaderboard', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', id, 'slug', slug, 'displayName', display_name, 'status', status,
        'visits', visits, 'clicks', clicks
      ) order by visits desc, clicks desc), '[]'::jsonb) from leaders)
  );
$$;

-- Re-granted because CREATE OR REPLACE keeps the existing grants, but this file
-- should not depend on that to stay true — migration 0004 revokes EXECUTE by
-- default in this schema, and the grant is stated wherever the function is.
revoke all on function public.program_analytics(timestamptz, timestamptz, text, int)
  from public, anon, authenticated;

grant execute on function public.program_analytics(timestamptz, timestamptz, text, int)
  to service_role;
