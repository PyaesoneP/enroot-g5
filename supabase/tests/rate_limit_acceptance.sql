-- Acceptance tests for the store-backed rate limiter (issue #11, 0009).
-- Pure SQL, fully rolled back, keys prefixed "test:" — re-runnable on the
-- live schema:  supabase db query --linked -f supabase/tests/rate_limit_acceptance.sql

reset role;
begin;

-- R4: anon / authenticated cannot touch the limiter at all.
set role anon;
do $$
begin
  begin
    perform * from public.rate_limit_hit('test:anon', 60, 10);
    raise exception 'R4 FAIL: anon executed rate_limit_hit';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.rate_limit_release('test:anon', 60);
    raise exception 'R4 FAIL: anon executed rate_limit_release';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.rate_limits limit 1;
    raise exception 'R4 FAIL: anon read rate_limits';
  exception when insufficient_privilege then null;
  end;
  raise notice 'R4 PASS: anon cannot execute the limiter or read rate_limits';
end $$;
reset role;

set role service_role;

-- R1: 10 hits allowed, the 11th denied with retry_after > 0.
-- A one-day window keeps all hits inside one window during the test.
do $$
declare r record; i int;
begin
  for i in 1..10 loop
    select * into r from public.rate_limit_hit('test:r1', 86400, 10);
    if not r.allowed then raise exception 'R1 FAIL: hit % denied', i; end if;
  end loop;
  select * into r from public.rate_limit_hit('test:r1', 86400, 10);
  if r.allowed or r.retry_after < 1 then
    raise exception 'R1 FAIL: 11th hit allowed=% retry_after=%', r.allowed, r.retry_after;
  end if;
  raise notice 'R1 PASS: 10 allowed, 11th denied (retry_after % s)', r.retry_after;
end $$;

-- R2: release gives back a slot (hits 11 -> 10 -> 9, so one more passes).
do $$
declare r record;
begin
  perform public.rate_limit_release('test:r1', 86400);
  perform public.rate_limit_release('test:r1', 86400);
  select * into r from public.rate_limit_hit('test:r1', 86400, 10);
  if not r.allowed then raise exception 'R2 FAIL: hit after release denied'; end if;
  raise notice 'R2 PASS: release frees a slot';
end $$;

-- R2b: release never goes below zero.
do $$
declare h int;
begin
  perform public.rate_limit_release('test:r2b', 86400);
  perform * from public.rate_limit_hit('test:r2b', 86400, 10);
  perform public.rate_limit_release('test:r2b', 86400);
  perform public.rate_limit_release('test:r2b', 86400);
  reset role;
  select hits into h from public.rate_limits where key = 'test:r2b';
  set role service_role;
  if h <> 0 then raise exception 'R2b FAIL: hits = %, expected 0', h; end if;
  raise notice 'R2b PASS: release floors at zero';
end $$;

-- R3: keys are independent.
do $$
declare r record;
begin
  select * into r from public.rate_limit_hit('test:r3', 86400, 1);
  if not r.allowed then raise exception 'R3 FAIL: fresh key denied'; end if;
  raise notice 'R3 PASS: a full key does not affect another key';
end $$;

-- R5: a new window starts from zero (back-date the current row).
do $$
declare r record;
begin
  perform * from public.rate_limit_hit('test:r5', 60, 1);
  select * into r from public.rate_limit_hit('test:r5', 60, 1);
  if r.allowed then raise exception 'R5 FAIL: 2nd hit in window allowed'; end if;
  reset role;
  update public.rate_limits set window_start = window_start - interval '1 minute' where key = 'test:r5';
  set role service_role;
  select * into r from public.rate_limit_hit('test:r5', 60, 1);
  if not r.allowed then raise exception 'R5 FAIL: first hit of new window denied'; end if;
  raise notice 'R5 PASS: a new window resets the count';
end $$;

-- R6: bad arguments are rejected, not silently accepted.
do $$
begin
  begin
    perform * from public.rate_limit_hit('test:r6', 0, 10);
    raise exception 'R6 FAIL: window 0 accepted';
  exception when raise_exception then
    if sqlerrm like 'R6 FAIL%' then raise; end if;
  end;
  raise notice 'R6 PASS: bad arguments rejected';
end $$;

select 'ALL RATE-LIMIT TESTS PASS (R1-R6; rolled back, live-safe)' as result;
reset role;
rollback;
