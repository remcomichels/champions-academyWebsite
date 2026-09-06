-- The house split, on the admin leaderboard.
--
-- Each owner's own dashboard already shows their share of the traffic that
-- arrived with no referral link — but only their own, so nobody can see whether
-- the split is actually coming out even. That question belongs on the admin
-- board, the one place the whole programme is visible at once.
--
-- Affiliate-facing surfaces are deliberately unchanged: the privacy policy says
-- an affiliate sees counts for their own link and nothing about anybody else,
-- and this keeps that true.
--
-- Patched from the definition in 20260831134747_remove_whop.sql, which is the
-- current one — not from 20260826153549, which created this function and has
-- since been superseded. The first attempt at this migration patched the older
-- text and failed on `public.conversions`, a table the whop removal dropped in
-- the same migration that rewrote this function to stop reading it. When two
-- migrations define the same function, the later one is the source.

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
    -- `source` is the only addition here. Everything below that counted rows
    -- out of this CTE still counts all of them; the split is taken as a
    -- filtered count alongside, so no existing figure changes meaning.
    select affiliate_id, occurred_at, referrer_host, country, source
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
           -- The part of `visits` this affiliate did not earn through their own
           -- link. Zero for everyone outside the rotation, which is all but the
           -- two owners.
           coalesce(lv.house, 0) as house_visits,
           coalesce(lc.n, 0) as clicks
    from public.affiliates a
    left join (
      select affiliate_id,
             count(*)::int n,
             count(*) filter (where source = 'house')::int house
      from v group by 1
    ) lv on lv.affiliate_id = a.id
    left join (select affiliate_id, count(*)::int n from c group by 1) lc on lc.affiliate_id = a.id
    -- Reserved slugs are seeded as revoked rows with no traffic and would
    -- otherwise pad the tail of the board.
    where coalesce(lv.n, 0) + coalesce(lc.n, 0) > 0
    order by visits desc, clicks desc
    limit p_leaders
  )

  select jsonb_build_object(
    'visits', (select count(*)::int from v),
    -- The pool, programme-wide: what the owners in the rotation are dividing.
    'house_visits', (select count(*)::int from v where source = 'house'),
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
        'visits', visits, 'houseVisits', house_visits, 'clicks', clicks
      ) order by visits desc, clicks desc), '[]'::jsonb) from leaders)
  );
$$;
