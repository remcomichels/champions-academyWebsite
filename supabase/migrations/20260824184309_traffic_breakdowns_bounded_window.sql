-- Recovered from the database, not authored here.
--
-- This change was applied straight to production and never written down, so
-- the repo described an affiliate_traffic() that took three arguments while
-- the live one took four. Anything built from these files alone — a fresh
-- environment, a restore, a new machine — would have produced the old
-- signature and failed on every call the dashboard makes.
--
-- Reconstructed verbatim from supabase_migrations.schema_migrations, under the
-- version it was recorded with, so the two now agree.

-- Replaces the 3-arg version. Dropped rather than left alongside: with p_until
-- defaulted, a 3-argument call would match both and Postgres would raise on the
-- ambiguity.
drop function if exists public.affiliate_traffic(uuid, timestamptz, text);

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
  heat as (
    select extract(isodow from occurred_at at time zone p_timezone)::int as dow,
           extract(hour   from occurred_at at time zone p_timezone)::int as hour,
           count(*)::int as visits
    from v group by 1, 2
  )
  select jsonb_build_object(
    'total', (select count(*)::int from v),
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

revoke all on function public.affiliate_traffic(uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.affiliate_traffic(uuid, timestamptz, timestamptz, text)
  to service_role;
