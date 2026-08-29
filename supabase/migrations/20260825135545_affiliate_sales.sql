-- Sales figures for the affiliate dashboard's Sales tab.
--
-- Nothing new is recorded for this. `conversions` is written by the Whop
-- webhook (server/utils/conversions.ts) and already holds the payment id, the
-- buyer's username, a status and a timestamp; this only aggregates it.
--
-- Deliberately no money. Whop owns commission, the 30-day hold and the payout,
-- and this dashboard reports attribution only — there is no amount column to
-- read here, so none can leak through this function either.
--
-- An RPC for the same reason as affiliate_traffic: PostgREST has no GROUP BY,
-- so the alternative is pulling every conversion row and bucketing it in the
-- handler, which `db_max_rows` caps. Sales are far rarer than visits and would
-- be unlikely to hit that today, but a chart that silently loses its early days
-- once an affiliate does well is exactly the failure worth designing out — and
-- the cost of doing it properly is one function.
--
-- SECURITY INVOKER, and EXECUTE granted to service_role only: our server calls
-- this with the secret key, passing the affiliate id it resolved from the
-- session. No browser role can reach it, so the id parameter is not a tenancy
-- hole.

-- p_until closes the window at both ends, so one function serves the current
-- period and the one before it — which is what the trend under each figure
-- compares against. Without an upper bound the "previous" call would include
-- the current period too.
create or replace function public.affiliate_sales(
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
  with c as (
    select occurred_at
    from public.conversions
    where affiliate_id = p_affiliate_id
      -- A conversion with no timestamp cannot be placed on the series and is
      -- excluded from the window on both sides, so it never lands in one
      -- period's count and not the other's. The all-time tile counts it, and
      -- that tile takes no window.
      and occurred_at is not null
      and occurred_at >= p_since
      and occurred_at <  p_until
  ),
  -- Bucketed in the affiliate's own zone, matching the heatmap. A sale at
  -- 01:00 in Amsterdam is the previous day in UTC, and a chart that disagrees
  -- with the date beside it in the table below reads as a bug.
  daily as (
    select (occurred_at at time zone p_timezone)::date as day,
           count(*)::int as sales
    from c group by 1
  ),
  -- Visits over the same window, so the conversion rate divides two figures
  -- counted the same way. `referral_visits` is one row per person per day, and
  -- so is a sale for this purpose.
  v as (
    select count(*)::int as visits
    from public.referral_visits
    where affiliate_id = p_affiliate_id
      and occurred_at >= p_since
      and occurred_at <  p_until
  ),
  -- The middle step of the funnel. Only the VIP link can produce a sale, so it
  -- is the only click role that belongs between a visit and a purchase —
  -- counting Telegram and Calendly clicks here would put people in a funnel
  -- they were never in. Deduplicated per person per day by a unique index, the
  -- same as visits, so all three steps are counted the same way and the drop
  -- between them is real rather than an artefact of three different units.
  clk as (
    select count(*)::int as clicks
    from public.referral_clicks
    where affiliate_id = p_affiliate_id
      and role = 'vip'
      and occurred_at >= p_since
      and occurred_at <  p_until
  )
  select jsonb_build_object(
    'sales', (select count(*)::int from c),
    'visits', (select visits from v),
    'vip_clicks', (select clicks from clk),
    -- Sparse on purpose: a day with no sales has no row. The handler fills the
    -- gaps, because it is the side that knows the window's start and end.
    'daily', (
      select coalesce(jsonb_agg(jsonb_build_object('day', day, 'sales', sales)
             order by day), '[]'::jsonb) from daily)
  );
$$;

-- Migration 0004 revokes EXECUTE by default for new functions in this schema,
-- but that file's own principle is to grant explicitly rather than to rely on
-- inheritance surviving a future change.
revoke all on function public.affiliate_sales(uuid, timestamptz, timestamptz, text)
  from public, anon, authenticated;

grant execute on function public.affiliate_sales(uuid, timestamptz, timestamptz, text)
  to service_role;

-- The function filters on affiliate_id and occurred_at together. The index in
-- migration 0001 is `(affiliate_id, occurred_at desc nulls last)`, which serves
-- this — named here only so the dependency is visible from the file that needs
-- it. No new index: adding a second one over the same two columns would cost
-- writes on every webhook for nothing.
