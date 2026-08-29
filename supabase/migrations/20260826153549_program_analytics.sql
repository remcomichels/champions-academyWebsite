-- Programme-wide analytics for the admin dashboard.
--
-- The affiliate-facing functions answer "how is this one person doing". This
-- one answers "how is the programme doing, and who is carrying it" — the same
-- three tables, aggregated across every affiliate instead of filtered to one.
--
-- An RPC for the same reason affiliate_traffic and affiliate_sales are:
-- PostgREST has no GROUP BY, so the alternative is pulling every visit row in
-- the system and bucketing it in the handler. That is capped by `db_max_rows`,
-- which would silently undercount rather than fail — and this is the one query
-- in the system whose row count grows with every affiliate at once.
--
-- No money, deliberately, matching affiliate_sales. Whop owns commission and
-- payouts; `conversions` has no amount column, so none can leak through here.
--
-- SECURITY INVOKER, EXECUTE to service_role only. Unlike the affiliate
-- functions this takes no id to scope by — the scoping *is* requireAdmin in the
-- handler, so it must stay unreachable by any browser role.
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
  s as (
    select affiliate_id, occurred_at
    from public.conversions
    -- Matches affiliate_sales: a conversion with no timestamp cannot be placed
    -- on the series, so it is excluded from both windows rather than landing in
    -- one period's count and not the other's.
    where occurred_at is not null
      and occurred_at >= p_since and occurred_at < p_until
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
  s_day as (
    select (occurred_at at time zone p_timezone)::date as day, count(*)::int as n
    from s group by 1
  ),

  src as (
    select referrer_host as host, count(*)::int as visits
    from v group by 1 order by 2 desc limit 12
  ),
  ctry as (
    select country, count(*)::int as visits
    from v where country is not null group by 1 order by 2 desc limit 12
  ),
  roles as (
    select role, count(*)::int as clicks from c group by 1 order by 2 desc
  ),

  -- Ranked on sales first because that is what the programme is for, then
  -- visits to break ties among everyone on zero. Revoked affiliates are
  -- included: their traffic happened, and dropping them would make the
  -- leaderboard disagree with the totals above it.
  leaders as (
    select a.id, a.slug, a.display_name, a.status,
           coalesce(lv.n, 0) as visits,
           coalesce(lc.n, 0) as clicks,
           coalesce(ls.n, 0) as sales
    from public.affiliates a
    left join (select affiliate_id, count(*)::int n from v group by 1) lv on lv.affiliate_id = a.id
    left join (select affiliate_id, count(*)::int n from c group by 1) lc on lc.affiliate_id = a.id
    left join (select affiliate_id, count(*)::int n from s group by 1) ls on ls.affiliate_id = a.id
    -- Reserved slugs are seeded as revoked rows with no traffic and would
    -- otherwise pad the tail of the board.
    where coalesce(lv.n, 0) + coalesce(lc.n, 0) + coalesce(ls.n, 0) > 0
    order by sales desc, visits desc
    limit p_leaders
  )

  select jsonb_build_object(
    'visits', (select count(*)::int from v),
    'clicks', (select count(*)::int from c),
    'sales',  (select count(*)::int from s),
    'country_count', (select count(distinct country)::int from v where country is not null),
    -- "Selling" and "earning" are different questions from "exists": an
    -- affiliate who has never been sent a code still counts in the total.
    'affiliates_total',  (select count(*)::int from public.affiliates where status = 'active'),
    'affiliates_active', (select count(distinct affiliate_id)::int from v),
    'affiliates_selling',(select count(distinct affiliate_id)::int from s),
    'by_day', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'day', d.day,
        'visits', coalesce(vd.n, 0),
        'clicks', coalesce(cd.n, 0),
        'sales',  coalesce(sd.n, 0)
      ) order by d.day), '[]'::jsonb)
      from days d
      left join v_day vd on vd.day = d.day
      left join c_day cd on cd.day = d.day
      left join s_day sd on sd.day = d.day
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
        'visits', visits, 'clicks', clicks, 'sales', sales
      ) order by sales desc, visits desc), '[]'::jsonb) from leaders)
  );
$$;

revoke all on function public.program_analytics(timestamptz, timestamptz, text, int)
  from public, anon, authenticated;

grant execute on function public.program_analytics(timestamptz, timestamptz, text, int)
  to service_role;
