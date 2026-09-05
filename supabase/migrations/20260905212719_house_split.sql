-- The house split.
--
-- Two owners want the traffic that arrives without a `?r=` link divided
-- between them, so that clicking Join sends a visitor into one of their two
-- Telegram groups instead of to the shared default link.
--
-- The assignment happens when someone clicks, not when they land — see
-- server/routes/go/[role].get.ts. Assigning on arrival would mean setting a
-- referral cookie on every visitor, and the referral middleware marks any
-- response carrying one as no-store, which would take the whole marketing
-- site out of the CDN cache. Splitting on the click also counts people who
-- showed intent rather than every bot that touched the homepage.

-- Who is in the rotation.
--
-- A flag rather than two ids in an environment variable: an admin can change
-- it without a deploy, and it generalises past two owners without another
-- migration. Nothing enforces exactly two — the route divides evenly across
-- however many are flagged and active.
alter table public.affiliates
  add column if not exists house_share boolean not null default false;

comment on column public.affiliates.house_share is
  'In the house rotation: takes a share of visitors who arrived with no referral link.';

-- Where a visit came from.
--
-- Every existing row is a genuine referral, so the default backfills the table
-- correctly and there is no data migration to run.
--
-- Note the interaction with referral_visits_dedupe (affiliate_id, visitor_hash,
-- day): one visitor already counts once per affiliate per day whatever the
-- source. Someone assigned by the house split who later arrives through that
-- same owner's real link on the same day stays recorded as 'house'. That is the
-- unique index doing its job, and the alternative — counting them twice — would
-- be worse.
alter table public.referral_visits
  add column if not exists source text not null default 'link'
  check (source in ('link', 'house'));

comment on column public.referral_visits.source is
  'link = arrived through this affiliate''s own ?r= link. house = assigned by the house split.';

-- The dashboard reports the two separately over a window, so the split has to
-- be countable without scanning the affiliate's whole history.
create index if not exists referral_visits_source_idx
  on public.referral_visits (affiliate_id, source, occurred_at desc);

-- ─────────────────────────────────────────────────────── affiliate_traffic
--
-- Same signature, so nothing that calls it has to change and no grant has to
-- be reissued. It gains one figure: how much of `total` arrived through the
-- house split rather than through the affiliate's own link.
--
-- `total` deliberately still counts both. It is the number of people this
-- affiliate's dashboard is reporting on, and house traffic is genuinely theirs
-- — it is just not traffic they went out and earned. The dashboard shows the
-- subset underneath it rather than quietly changing what the headline means.
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
    select occurred_at, referrer_host, country, source
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
    from v where country is not null group by 1 order by 2 desc limit 12
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
    'house_total', (select count(*)::int from v where source = 'house'),
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
