-- Lock down function EXECUTE.
--
-- Migration 0003 revoked privileges "from anon, authenticated", which is not
-- enough for functions. Postgres grants EXECUTE on every new function to the
-- PUBLIC pseudo-role by default, and anon/authenticated inherit from PUBLIC —
-- so the revoke removed grants those roles never held directly, and both could
-- still call everything through PostgREST at /rest/v1/rpc/<name>.
--
-- Concretely, before this migration:
--   POST /rest/v1/rpc/rl_reset {"p_bucket": "..."} with only the publishable
--   key would clear a rate-limit bucket. That defeats the login throttle
--   outright, and rl_hit could be used the other way to lock a bucket.
--
-- Caught by the Supabase security advisor (0028/0029).

-- ─────────────────────────────────────── rate limiter: service role only
-- These must never be reachable from a browser. Revoke from PUBLIC, which is
-- what actually carries the default grant.
revoke all on function public.rl_hit(text, int, interval, interval) from public, anon, authenticated;
revoke all on function public.rl_reset(text)                        from public, anon, authenticated;
revoke all on function public.rl_sweep()                            from public, anon, authenticated;

-- Granted explicitly rather than relying on inheritance, so this survives a
-- future default-privileges change.
grant execute on function public.rl_hit(text, int, interval, interval) to service_role;
grant execute on function public.rl_reset(text)                        to service_role;
grant execute on function public.rl_sweep()                            to service_role;

-- ────────────────────────────────────────────── is_admin: no anon access
-- `authenticated` keeps EXECUTE because the RLS policies in 0003 call this
-- function, and a policy expression is evaluated with the querying role's
-- privileges — revoking it there would make those policies error rather than
-- evaluate. anon has no business calling it at all.
revoke all on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated, service_role;

-- ───────────────────────────────── set_updated_at: pin the search_path
-- A trigger function with a mutable search_path can be redirected by a role
-- that controls its own search_path. Low risk here (SECURITY INVOKER), but
-- there is no reason to leave it unpinned. Advisor lint 0011.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

revoke all on function public.set_updated_at() from public, anon, authenticated;

-- ──────────────────────────────────────────── stop this recurring
-- New functions in this schema get no PUBLIC execute grant from now on, so a
-- helper added later is locked down by default instead of by remembering.
alter default privileges in schema public revoke execute on functions from public;
