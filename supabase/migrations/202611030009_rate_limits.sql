-- Issue #11: store-backed rate limiting. The in-memory limiter counted per
-- serverless instance, so a burst spread over instances slipped through;
-- this counter is shared by all of them (Doc 4 sec 4.2.3).
--
-- Keys are opaque: the app sends "ip:<hmac>" / "guest:<hmac>" (HMAC-SHA256,
-- server-side key), never a raw IP — "no IP in the DB" (doc 05, PDPA)
-- still holds. Rows live at most a day.

create table public.rate_limits (
  key          text        not null check (char_length(key) between 1 and 128),
  window_start timestamptz not null,
  hits         integer     not null default 0 check (hits >= 0),
  primary key (key, window_start)
);

alter table public.rate_limits enable row level security;
revoke all on table public.rate_limits from public, anon, authenticated;

-- Counts one hit in the current fixed window and says whether it is within
-- p_max. Atomic across instances (upsert). Hits over the cap still count,
-- so a flood stays blocked for the rest of its window.
create or replace function public.rate_limit_hit(
  p_key        text,
  p_window_sec integer,
  p_max        integer
)
returns table (allowed boolean, retry_after integer)
language plpgsql
security definer
set search_path = public
as $$
declare
  w timestamptz;
  n integer;
begin
  if p_key is null or p_window_sec is null or p_window_sec not between 1 and 86400
     or p_max is null or p_max < 1 then
    raise exception 'rate_limit_hit: bad arguments';
  end if;
  w := to_timestamp(floor(extract(epoch from now()) / p_window_sec) * p_window_sec);

  insert into public.rate_limits as r (key, window_start, hits)
  values (p_key, w, 1)
  on conflict (key, window_start) do update set hits = r.hits + 1
  returning r.hits into n;

  -- Housekeeping: this key's stale windows (bounded, indexed by the PK).
  delete from public.rate_limits
   where rate_limits.key = p_key and window_start < now() - interval '1 day';

  allowed := n <= p_max;
  retry_after := case when allowed then 0
                 else greatest(1, ceil(extract(epoch from (w + make_interval(secs => p_window_sec) - now())))::integer)
                 end;
  return next;
end $$;

-- Gives back one hit in the current window (a sign-up that was not stored
-- stays free, as with the old limiter). Never goes below zero.
create or replace function public.rate_limit_release(
  p_key        text,
  p_window_sec integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_key is null or p_window_sec is null or p_window_sec not between 1 and 86400 then
    raise exception 'rate_limit_release: bad arguments';
  end if;
  update public.rate_limits
     set hits = greatest(hits - 1, 0)
   where key = p_key
     and window_start = to_timestamp(floor(extract(epoch from now()) / p_window_sec) * p_window_sec);
end $$;

-- Supabase grants EXECUTE on new functions to anon by default: name the
-- roles explicitly (0007 precedent). Server (service_role) only.
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
revoke execute on function public.rate_limit_release(text, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
grant execute on function public.rate_limit_release(text, integer) to service_role;
