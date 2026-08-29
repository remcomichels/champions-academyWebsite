-- Lets an admin view an affiliate's dashboard.
--
-- The target is stored on the *session*, not passed with the request. That is
-- the whole design. server/utils/auth.ts is the isolation boundary for this
-- system: no handler under server/api/affiliate/ may read an affiliate id from
-- a query string, route parameter or body, and there is a grep in CI for it,
-- because that is exactly the IDOR the boundary exists to prevent. Adding an
-- `?affiliateId=` to those routes for an admin would punch a hole straight
-- through it and leave every one of them one missing check away from serving
-- any affiliate to anybody.
--
-- Kept here instead, the id is server-side state an admin has to have been
-- granted, requireAffiliate is the only thing that reads it, and the affiliate
-- routes carry on knowing nothing about it.
alter table public.sessions
  add column impersonating_affiliate_id uuid
    references public.affiliates(id) on delete set null,
  -- Not decoration: it is what the banner counts from, and what makes a
  -- session left in this state overnight visible in the audit trail.
  add column impersonation_started_at timestamptz;

-- Partial: the overwhelming majority of sessions are nobody viewing anybody,
-- and this only ever answers "who is currently being viewed".
create index sessions_impersonating_idx
  on public.sessions (impersonating_affiliate_id)
  where impersonating_affiliate_id is not null;
