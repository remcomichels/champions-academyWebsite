-- Pending email-address changes.
--
-- Same shape and the same reasoning as password_resets: our own table rather
-- than Supabase's built-in email-change flow, because that one hands the
-- *browser* a Supabase session and expects the Supabase JS client to be running
-- in the page to catch it — which this project does not have and does not want.
-- Supabase is server-side only here; session.ts exists precisely so the browser
-- never holds a JWT.
--
-- The flow: signed in, an affiliate names a new address. Nothing changes yet.
-- A link goes to the *new* address, and clicking it is what proves the mailbox
-- is theirs — only then does auth.users move. The address they are leaving gets
-- a notice at the same time, which is the one thing that makes a stolen session
-- survivable: whoever still reads the old inbox finds out a change is in
-- flight while it is still in flight.
create table public.email_changes (
  id      uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,

  -- Stored in the clear, unlike everything else on this row, because it is the
  -- thing being applied rather than a credential: the confirmation step has to
  -- know which address to move to. The secret is `token_hash` below, and the
  -- address on its own opens nothing.
  new_email text not null,

  -- hex(hmac_sha256(OTP_PEPPER, 'emailchange:' || token)). Same pepper as the
  -- invite codes and the reset links, domain-separated by that prefix so a
  -- value lifted from one table can never validate against another.
  token_hash text not null unique,

  -- Twenty-four hours, where a password reset gets one.
  --
  -- The two links are not the same kind of key. A reset link is a way into the
  -- account for whoever holds it, so its window is the whole risk. This one
  -- only finishes a change the account holder already started while signed in,
  -- and it is delivered to the address it would hand control to — so the
  -- person who can read it is the person it is verifying. A day is long enough
  -- to survive a mailbox somebody only opens in the evening.
  expires_at timestamptz not null,
  -- Set the moment it is redeemed. Single use.
  used_at    timestamptz,

  created_at timestamptz not null default now(),

  -- Who asked. Not for display — it is what lets us answer "I never asked for
  -- this" with something better than a shrug.
  requested_ip inet,
  requested_ua text
);

-- Drives both the "is a change pending" read on the settings page and the
-- supersede-then-insert in emailChange.ts.
create index email_changes_user_idx   on public.email_changes (user_id);
-- Drives the purge of dead rows on each new request.
create index email_changes_expiry_idx on public.email_changes (expires_at);

-- No unique index pinning one live request per user, for the same reason
-- password_resets has none: the invariant is kept in the handler, which deletes
-- any prior rows for the user before inserting, and the predicate that would
-- express it (`expires_at > now()`) is not immutable and so not indexable.
--
-- Nor a unique index on new_email. Two people can have a pending change to the
-- same address without either of them being wrong yet — the address is only
-- claimed at confirmation, which re-checks it and refuses the loser. A unique
-- index here would instead let anyone reserve an address they do not own by
-- requesting a change to it and never confirming.

-- ── RLS ─────────────────────────────────────────────────────────────────────
-- Deny-all with no policies, matching every other table here: all access goes
-- through our server with the secret key, which bypasses RLS, and nothing in
-- the browser talks to Supabase in this project.
alter table public.email_changes enable row level security;

-- Belt and braces: without a grant the browser roles cannot reach the relation
-- to be refused by a policy in the first place.
revoke all on public.email_changes from anon, authenticated;
