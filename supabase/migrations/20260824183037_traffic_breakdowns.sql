-- Traffic breakdowns for the affiliate dashboard.
--
-- Every dimension here is already recorded by server/middleware/referral.ts on
-- the `?r=` hit — referrer_host, country, path and the timestamp. Nothing new
-- is collected; this only aggregates what is there.
--
-- An RPC rather than four PostgREST queries, for two reasons. PostgREST has no
-- GROUP BY, so the alternative is pulling every visit row and counting in the
-- handler — and that is capped by `db_max_rows` (unset here, so PostgREST's
-- default applies), which would silently undercount a busy affiliate rather
-- than fail. Aggregating in Postgres returns one row and cannot be truncated.
--
-- SECURITY INVOKER, and EXECUTE is granted to service_role only: our server
-- calls this with the secret key and passes the affiliate id it resolved from
-- the session. No browser role can reach it, so the id parameter is not a
-- tenancy hole.

-- p_until makes the window closed at both ends, so the same function serves the
-- current period and the one before it — which is what the trend under each
-- figure compares. Without an upper bound the "previous" call would include the
-- current period too.
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
    select occurred_at, referrer_host, country, path
    from public.referral_visits
    where affiliate_id = p_affiliate_id
      and occurred_at >= p_since
      and occurred_at <  p_until
  ),
  -- NULL referrer_host is direct traffic (someone typed it, or the referrer was
  -- stripped). Kept as its own bucket rather than dropped: for an affiliate
  -- sharing a link in a DM or a story, direct is often the largest source, and
  -- hiding it would make the numbers not add up.
  src as (
    select referrer_host as host, count(*)::int as visits
    from v group by 1 order by 2 desc limit 12
  ),
  ctry as (
    select country, count(*)::int as visits
    from v where country is not null group by 1 order by 2 desc limit 12
  ),
  pth as (
    select path, count(*)::int as visits
    from v where path is not null group by 1 order by 2 desc limit 12
  ),
  -- isodow is 1=Monday..7=Sunday, which matches how the grid is drawn.
  -- Converted into the affiliate's own timezone: "when should I post" is
  -- meaningless in UTC. The caller validates the timezone string first — an
  -- unknown name makes `at time zone` raise.
  heat as (
    select extract(isodow from occurred_at at time zone p_timezone)::int as dow,
           extract(hour   from occurred_at at time zone p_timezone)::int as hour,
           count(*)::int as visits
    from v group by 1, 2
  )
  select jsonb_build_object(
    'total', (select count(*)::int from v),
    -- Counted separately from the list above, which is capped at 12 for display
    -- — an affiliate reaching more than twelve countries would otherwise see
    -- the tile stick at 12.
    'country_count', (select count(distinct country)::int from v where country is not null),
    'sources', (
      select coalesce(jsonb_agg(jsonb_build_object('host', host, 'visits', visits)
             order by visits desc), '[]'::jsonb) from src),
    'countries', (
      select coalesce(jsonb_agg(jsonb_build_object('country', country, 'visits', visits)
             order by visits desc), '[]'::jsonb) from ctry),
    'paths', (
      select coalesce(jsonb_agg(jsonb_build_object('path', path, 'visits', visits)
             order by visits desc), '[]'::jsonb) from pth),
    'heatmap', (
      select coalesce(jsonb_agg(jsonb_build_object('dow', dow, 'hour', hour, 'visits', visits)),
             '[]'::jsonb) from heat)
  );
$$;

-- Migration 0004 already revokes EXECUTE by default for new functions in this
-- schema, but that file's own principle is to grant explicitly rather than rely
-- on inheritance surviving a future change.
revoke all on function public.affiliate_traffic(uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.affiliate_traffic(uuid, timestamptz, timestamptz, text)
  to service_role;

-- The function filters on affiliate_id and occurred_at together.
create index if not exists referral_visits_affiliate_time_idx
  on public.referral_visits (affiliate_id, occurred_at desc);
