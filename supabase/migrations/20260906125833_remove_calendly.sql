-- Removing Calendly.
--
-- The booking link is no longer part of the offer, so it stops being one of the
-- swappable link roles. `lite` — the Telegram invite — is the only one left.
--
-- Same shape as 20260831134747_remove_whop.sql, and the same reasoning: a role
-- that nothing sets and nothing renders is worse than no role at all, because
-- the next person has to work out whether it is dead or merely unused.

-- No affiliate has one set, so this drops a column and no data.
alter table public.affiliates
  drop column if exists calendly_url;

-- `referral_clicks.role` is deliberately left alone.
--
-- The whop removal tightened this constraint from ('vip','lite','calendly') to
-- ('lite','calendly') because there were no vip rows to invalidate. That is not
-- the case here: 35 calendly clicks are already recorded, and they are real
-- things people did. Narrowing the constraint to ('lite') would either fail on
-- those rows or require deleting them, and deleting them would quietly restate
-- what last month's click figures were.
--
-- So the column keeps accepting a value nothing writes any more. The dashboard
-- keeps its "Book a call" label for the same reason — see the note in
-- app/components/dashboard/analytics.vue. When the retention window has rolled
-- past the last of these rows, a later migration can narrow it for free.
