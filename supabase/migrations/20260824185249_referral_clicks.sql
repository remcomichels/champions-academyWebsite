-- Which of an affiliate's links their visitors actually click.
--
-- The landing-path breakdown this replaces could only ever report one value:
-- a referral link is `/?r=<slug>`, so every visit lands on `/`. What is
-- genuinely useful is which of the three links — VIP, Telegram, Calendly — the
-- traffic goes to, which nothing recorded until now.
--
-- Counted once per person per day per link, exactly like referral_visits. That
-- keeps it non-inflatable (refreshing and re-clicking your own link does
-- nothing) and, more importantly, keeps it comparable with the visit count:
-- a click-through rate is only meaningful if both sides count the same way.

create table public.referral_clicks (
  id           bigserial primary key,
  affiliate_id uuid not null references public.affiliates(id) on delete cascade,
  occurred_at  timestamptz not null default now(),
  day          date not null,

  -- Same recipe as referral_visits: sha256(VISIT_PEPPER || ip || ua || day).
  -- Pseudonymous, rotates daily, and no IP or user agent is ever stored.
  visitor_hash text not null,

  role text not null check (role in ('vip', 'lite', 'calendly'))
);

-- Makes a repeat click a no-op rather than an extra row.
create unique index referral_clicks_unique_daily
  on public.referral_clicks (affiliate_id, visitor_hash, day, role);

create index referral_clicks_affiliate_time_idx
  on public.referral_clicks (affiliate_id, occurred_at desc);

-- Migration 0003 set default privileges to revoke from anon and authenticated,
-- so this table is already unreachable from a browser. Restated explicitly for
-- the same reason 0004 grants explicitly: so it survives a future change to
-- those defaults rather than depending on them.
revoke all on public.referral_clicks from anon, authenticated;
revoke all on sequence public.referral_clicks_id_seq from anon, authenticated;

alter table public.referral_clicks enable row level security;
alter table public.referral_clicks force  row level security;

-- Read-only for the owning affiliate, mirroring referral_visits. Writes are
-- server-side with the secret key; there is no policy for them.
create policy referral_clicks_self_read on public.referral_clicks
  for select to authenticated
  using (exists (
    select 1 from public.affiliates a
     where a.id = referral_clicks.affiliate_id
       and a.user_id = (select auth.uid())
  ));

-- ───────────────────────────────────────────── fold clicks into the breakdown
-- Replaces `paths`, which reported the same single value for everyone.
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

revoke all on function public.affiliate_traffic(uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.affiliate_traffic(uuid, timestamptz, timestamptz, text)
  to service_role;
