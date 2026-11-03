-- 0009 follow-up: rate_limit_hit() only deleted the CALLING key's stale
-- windows, so a key that never came back (one visit from one IP) kept its
-- row forever, contradicting "rows live at most a day" (doc 05). Delete
-- every stale window instead; an index on window_start keeps it cheap.

create index if not exists rate_limits_window_start_idx
  on public.rate_limits (window_start);

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

  -- Housekeeping: drop every window older than a day (any key).
  delete from public.rate_limits where window_start < now() - interval '1 day';

  allowed := n <= p_max;
  retry_after := case when allowed then 0
                 else greatest(1, ceil(extract(epoch from (w + make_interval(secs => p_window_sec) - now())))::integer)
                 end;
  return next;
end $$;

-- create or replace keeps existing grants; restate them so this file is
-- correct on its own (0007 precedent).
revoke execute on function public.rate_limit_hit(text, integer, integer) from public, anon, authenticated;
grant execute on function public.rate_limit_hit(text, integer, integer) to service_role;
