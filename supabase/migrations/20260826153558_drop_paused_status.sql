-- Drop the `paused` affiliate status.
--
-- It was never a distinct state. Every guard in the codebase tests
-- `status <> 'active'` or filters `status = 'active'`, so a paused affiliate
-- lost their links, their sessions and their dashboard exactly like a revoked
-- one — the enum value only ever offered a third label for the second
-- behaviour. Access is binary, so the type says so.
--
-- Removing it properly rather than leaving it unused: a value nothing reads is
-- one a future writer can still set, and the behaviour it would get is the one
-- nobody designed.

-- Depends on the enum, so it has to go first and come back at the end.
drop index if exists public.affiliates_active_idx;

-- Paused meant revoked in practice; say so before the value disappears.
update public.affiliates set status = 'revoked' where status = 'paused';

alter type public.affiliate_status rename to affiliate_status_old;

create type public.affiliate_status as enum ('active', 'revoked');

-- The default is dropped and restored around the cast: it is an expression of
-- the old type, and Postgres refuses the ALTER while it still refers to one.
alter table public.affiliates
  alter column status drop default,
  alter column status type public.affiliate_status
    using status::text::public.affiliate_status,
  alter column status set default 'active';

drop type public.affiliate_status_old;

create index affiliates_active_idx on public.affiliates (slug) where status = 'active';
