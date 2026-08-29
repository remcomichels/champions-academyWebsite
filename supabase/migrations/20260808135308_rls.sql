-- Row level security.
--
-- Be clear about what this does and does not buy us. Server routes use the
-- secret key, which bypasses RLS, so RLS protects nothing on the primary
-- access path. Isolation between affiliates is enforced in application code:
-- every affiliate-scoped handler resolves the affiliate from the session
-- cookie and never from a request parameter.
--
-- What RLS is for here is defence in depth against a publishable key. The
-- single most important statement in this file is the REVOKE below.

-- ─────────────────────────────────────────────────────────────── revoke
-- Nothing in this schema should be reachable with a publishable key, now or
-- after someone adds a table and forgets to think about it.
revoke all on all tables    in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;
revoke all on all functions in schema public from anon, authenticated;

alter default privileges in schema public revoke all on tables    from anon, authenticated;
alter default privileges in schema public revoke all on sequences from anon, authenticated;
alter default privileges in schema public revoke all on functions from anon, authenticated;

-- ────────────────────────────────────────────────────────── enable RLS
-- FORCE as well as ENABLE. Safe with the secret key, which bypasses via the
-- BYPASSRLS role attribute rather than table ownership.
do $$
declare t text;
begin
  foreach t in array array[
    'affiliates', 'affiliate_slug_aliases', 'admin_users', 'affiliate_invites',
    'sessions', 'conversions', 'referral_visits', 'notifications',
    'rate_limits', 'whop_stats_cache', 'gdpr_requests', 'audit_log'
  ] loop
    execute format('alter table public.%I enable row level security', t);
    execute format('alter table public.%I force  row level security', t);
  end loop;
end $$;

-- ────────────────────────────────────────────────────────────── helper
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (select 1 from public.admin_users where user_id = auth.uid());
$$;

-- ───────────────────────────────────────────────────────────── policies
-- Ceilings, not the mechanism. No route uses a user JWT today; if one ever
-- does, these are the limits it inherits. Note there is no policy for `anon`
-- anywhere in this file, and none of these grant write access.

create policy affiliates_self_read on public.affiliates
  for select to authenticated
  using (user_id = (select auth.uid()) or public.is_admin());

create policy conversions_self_read on public.conversions
  for select to authenticated
  using (exists (
    select 1 from public.affiliates a
     where a.id = conversions.affiliate_id
       and a.user_id = (select auth.uid())
  ));

create policy referral_visits_self_read on public.referral_visits
  for select to authenticated
  using (exists (
    select 1 from public.affiliates a
     where a.id = referral_visits.affiliate_id
       and a.user_id = (select auth.uid())
  ));

create policy notifications_self_read on public.notifications
  for select to authenticated
  using (exists (
    select 1 from public.affiliates a
     where a.id = notifications.affiliate_id
       and a.user_id = (select auth.uid())
  ));

create policy whop_stats_cache_self_read on public.whop_stats_cache
  for select to authenticated
  using (exists (
    select 1 from public.affiliates a
     where a.id = whop_stats_cache.affiliate_id
       and a.user_id = (select auth.uid())
  ));

create policy gdpr_requests_self_read on public.gdpr_requests
  for select to authenticated
  using (exists (
    select 1 from public.affiliates a
     where a.id = gdpr_requests.affiliate_id
       and a.user_id = (select auth.uid())
  ));

-- Deliberately NO policy, for any role, on:
--   sessions               — holds session token hashes
--   affiliate_invites      — holds invite code hashes
--   affiliate_slug_aliases — would let one affiliate enumerate another's slugs
--   admin_users            — membership is not something to leak
--   rate_limits            — reveals attack state
--   audit_log              — cross-affiliate by nature
-- These are reachable only with the secret key, from server code.
