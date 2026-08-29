-- Notification preferences.
--
-- Kept on the affiliate rather than in its own table: it is a handful of
-- booleans read on every dashboard load and written rarely, and a jsonb column
-- means adding a channel later needs no migration.
--
-- Email delivery is not wired up yet — no provider is configured — so the
-- email flags are stored and honoured by nothing today. They are here so the
-- preference survives from the moment sending exists, rather than defaulting
-- everyone into email the day it is switched on.

alter table public.affiliates
  add column if not exists notification_prefs jsonb not null default '{}'::jsonb;

comment on column public.affiliates.notification_prefs is
  'Per-channel notification toggles, e.g. {"saleInApp":true,"saleEmail":false}. Email flags are stored but not yet delivered.';
