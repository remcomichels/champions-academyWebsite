-- Rate limiting in Postgres.
--
-- Not an in-memory limiter: on serverless every invocation may get its own
-- process, so an in-memory counter bounds nothing. Postgres is the only
-- correct shared store here short of adding Redis.

-- Records a hit against a bucket and reports whether it is allowed.
--
-- The whole thing is one statement on purpose. A SELECT-then-UPDATE would let
-- two concurrent requests both read count = limit - 1 and both proceed, which
-- is exactly the case a login throttle exists to stop.
create or replace function public.rl_hit(
  p_bucket text,
  p_limit  int,
  p_window interval,
  p_lock   interval
)
returns table (allowed boolean, retry_after int)
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  r public.rate_limits%rowtype;
begin
  insert into public.rate_limits as rl (bucket, window_start, count)
  values (p_bucket, now(), 1)
  on conflict (bucket) do update set
    -- Window rolled over: start counting again from this hit.
    count = case
      when rl.window_start < now() - p_window then 1
      else rl.count + 1
    end,
    window_start = case
      when rl.window_start < now() - p_window then now()
      else rl.window_start
    end,
    locked_until = case
      -- An existing lock always wins, so hammering cannot extend or reset it.
      when rl.locked_until is not null and rl.locked_until > now() then rl.locked_until
      -- Tipped over the limit inside a live window: start the lock.
      when rl.window_start >= now() - p_window and rl.count + 1 > p_limit then now() + p_lock
      else null
    end
  returning * into r;

  if r.locked_until is not null and r.locked_until > now() then
    return query select false, ceil(extract(epoch from (r.locked_until - now())))::int;
  else
    return query select true, 0;
  end if;
end;
$$;

-- Clears a bucket. Called on a successful login or redemption so that a user
-- who eventually gets it right is not left throttled by their own typos.
create or replace function public.rl_reset(p_bucket text)
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.rate_limits where bucket = p_bucket;
$$;

-- Housekeeping: buckets are disposable once their window and lock have passed.
create or replace function public.rl_sweep()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.rate_limits
   where window_start < now() - interval '1 day'
     and (locked_until is null or locked_until < now());
$$;
