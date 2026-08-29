-- Password reset tokens.
--
-- Deliberately our own table rather than Supabase's built-in recovery flow.
-- That flow hands the *browser* a Supabase session and expects the Supabase JS
-- client to be running in the page to catch it — which this project does not
-- have and does not want: Supabase is server-side only here, and session.ts
-- exists precisely so the browser never holds a JWT. Its one expiry setting is
-- also shared across confirmation, magic-link, invite and recovery mail, so it
-- could not be tuned for resets alone even if the flow fitted.
--
-- Shape follows affiliate_invites: the raw token is never stored, only a
-- peppered HMAC of it, so a dump of this table on its own cannot be turned
-- back into a working link.
create table public.password_resets (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- hex(hmac_sha256(OTP_PEPPER, 'pwreset:' || token)). Same pepper as the
  -- invite codes, domain-separated by that prefix so a value from one table
  -- can never validate against the other.
  --
  -- HMAC rather than a slow KDF for the same reason invites use one: this is a
  -- 256-bit machine-generated secret, not a human password, so stretching buys
  -- nothing and would rule out the single indexed lookup.
  token_hash text not null unique,

  -- One hour. Short because the window is the whole risk: anyone who reaches
  -- this email — a shared inbox, a forwarded message, a borrowed laptop — owns
  -- the account until the link dies.
  expires_at timestamptz not null,
  -- Set the moment it is redeemed. Single use, so a link that has already
  -- changed a password cannot change it again.
  used_at    timestamptz,

  created_at timestamptz not null default now(),

  -- Who asked. Not for display — it is what lets us answer "someone keeps
  -- requesting resets for my account" with something better than a shrug.
  requested_ip inet,
  requested_ua text
);

create index password_resets_user_idx   on public.password_resets (user_id);
-- Drives the purge of dead rows on each new request.
create index password_resets_expiry_idx on public.password_resets (expires_at);

-- No unique index pinning one live token per user, on purpose.
--
-- The invariant is kept in the handler, which deletes any prior rows for the
-- user before inserting — so issuing a new link kills the old one. A unique
-- partial index cannot express the real predicate anyway (`expires_at > now()`
-- is not immutable, so it is not indexable), and the version that *is*
-- indexable would turn a harmless race into a failed reset for a legitimate
-- user. Two live links for the same person is not a security problem: same
-- account, same owner, both single-use, both dead within the hour.

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Deny-all with no policies, matching every other table here: all access goes
-- through our server with the secret key, which bypasses RLS, and nothing in
-- the browser talks to Supabase in this project.
alter table public.password_resets enable row level security;

-- Belt and braces: without a grant the browser roles cannot reach the relation
-- to be refused by a policy in the first place.
revoke all on public.password_resets from anon, authenticated;
