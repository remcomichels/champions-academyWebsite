-- The affiliate's own timezone, everywhere on their dashboard.
--
-- Two things wrong before this.
--
-- The Overview counted on `referral_visits.day`, which the referral middleware
-- writes as a UTC date. The Analytics tab counted with `affiliate_traffic`,
-- which buckets in the affiliate's timezone. Same rows, two answers: for an
-- affiliate at UTC+14, three visits in four landed on a different day depending
-- on which screen was asking, and "Today" showed most of yesterday.
--
-- The daily series was also built by selecting one row per visit and counting
-- them in the handler, because PostgREST cannot group. That is capped by
-- `db_max_rows` — a busy affiliate would have silently lost their earliest days
-- rather than seeing an error.
--
-- One function fixes both: every figure the Overview shows, bucketed on
-- `(occurred_at at time zone p_timezone)::date`, aggregated in Postgres.
--
-- SECURITY INVOKER, EXECUTE to service_role only — same as its siblings. The
-- affiliate id comes from the session, never from the request.
create or replace function public.affiliate_day_counts(
  p_affiliate_id uuid,
  p_timezone     text default 'UTC',
  p_days         int  default 30
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with bounds as (
    select (now() at time zone p_timezone)::date as today
  ),
  v as (
    select (occurred_at at time zone p_timezone)::date as local_day
    from public.referral_visits
    where affiliate_id = p_affiliate_id
  ),
  -- Every day in the window, so a quiet day plots as a zero instead of being
  -- absent and letting the chart join across the gap.
  days as (
    select generate_series((select today from bounds) - p_days,
                           (select today from bounds), interval '1 day')::date as day
  ),
  per_day as (
    select local_day, count(*)::int as n from v group by 1
  )
  select jsonb_build_object(
    'today',     (select count(*)::int from v, bounds where local_day = bounds.today),
    'yesterday', (select count(*)::int from v, bounds where local_day = bounds.today - 1),
    'recent',    (select count(*)::int from v, bounds where local_day >= bounds.today - p_days),
    -- The equally long window immediately before, which is what the trend
    -- under each figure compares against.
    'prior',     (select count(*)::int from v, bounds
                   where local_day >= bounds.today - (p_days * 2)
                     and local_day <  bounds.today - p_days),
    'total',     (select count(*)::int from v),
    'by_day',    (select coalesce(jsonb_agg(jsonb_build_object(
                          'day', d.day, 'count', coalesce(p.n, 0)) order by d.day), '[]'::jsonb)
                    from days d left join per_day p on p.local_day = d.day)
  );
$$;

revoke all on function public.affiliate_day_counts(uuid, text, int)
  from public, anon, authenticated;
grant execute on function public.affiliate_day_counts(uuid, text, int) to service_role;

-- ── Unknown geo becomes a row instead of disappearing ────────────────────────
-- `where country is not null` meant a visit whose country could not be
-- resolved was dropped from the breakdown entirely. Not misattributed — it was
-- never assigned to the wrong country — but the list quietly summed to less
-- than the visit total with nothing saying why, and a VPN or a stripped header
-- looked like it had simply not happened.
--
-- It is emitted as a null country and labelled by the client, the same way a
-- null referrer host is labelled "Direct". `country_count` deliberately still
-- counts only real countries: "Countries: 12" must not include "we don't know".
create or replace function public.affiliate_traffic(
  p_affiliate_id uuid,
  p_since        timestamptz,
  p_until        timestamptz default now(),
  p_timezone     text default 'UTC'
)
returns jsonb
language sql
stable
set search_path = public, pg_temp
as $$
  with v as (
    select occurred_at, referrer_host, country
    from public.referral_visits
    where affiliate_id = p_affiliate_id
      and occurred_at >= p_since
      and occurred_at <  p_until
  ),
  c as (
    select role
    from public.referral_clicks
    where affiliate_id = p_affiliate_id
      and occurred_at >= p_since
      and occurred_at <  p_until
  ),
  src as (
    select referrer_host as host, count(*)::int as visits
    from v group by 1 order by 2 desc limit 12
  ),
  ctry as (
    select country, count(*)::int as visits
    from v group by 1 order by 2 desc limit 12
  ),
  clk as (
    select role, count(*)::int as clicks
    from c group by 1 order by 2 desc
  ),
  heat as (
    select extract(isodow from occurred_at at time zone p_timezone)::int as dow,
           extract(hour   from occurred_at at time zone p_timezone)::int as hour,
           count(*)::int as visits
    from v group by 1, 2
  )
  select jsonb_build_object(
    'total', (select count(*)::int from v),
    'country_count', (select count(distinct country)::int from v where country is not null),
    'click_total', (select count(*)::int from c),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('host', host, 'visits', visits)
             order by visits desc), '[]'::jsonb) from src),
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('country', country, 'visits', visits)
             order by visits desc), '[]'::jsonb) from ctry),
    'clicks', (
      select coalesce(jsonb_agg(jsonb_build_object('role', role, 'clicks', clicks)
             order by clicks desc), '[]'::jsonb) from clk),
    'heatmap', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'visits', visits)),
             '[]'::jsonb) from heat)
  );
$$;

-- Same for the programme-wide view, so admin and affiliate agree.
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
    from v group by 1 order by 2 desc limit 12
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
