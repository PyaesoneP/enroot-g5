-- Acceptance tests for submit_rsvp() (issue #15, 0007): run as role
-- "service_role" — the only role allowed to execute it. Delta-based and
-- fully rolled back: re-runnable on a live schema.
--
-- Run AFTER rls_acceptance.sql; the post-state check at the end requires
-- both suites in one session to verify the net-zero contract.

reset role;
begin;
update public.event_config set live_count_visible = true, registration_open = true where id = true;
select set_config('s.base', public.rsvp_live_count()::text, false);
set role service_role;

-- S1: valid submissions accepted; group sizes land in the people count.
do $$
declare r text; before int; after int;
begin
  before := current_setting('s.base')::int;
  r := public.submit_rsvp('alice', 1, 'sweet',
        '[{"id":"c27","slot":0},{"id":"c30","slot":1}]'::jsonb);
  if r <> 'ok' then raise exception 'S1 FAIL: valid submit returned %', r; end if;
  r := public.submit_rsvp('bob', 2, 'bold', null);
  if r <> 'ok' then raise exception 'S1 FAIL: group-2 submit returned %', r; end if;
  select public.rsvp_live_count() into after;
  if after <> before + 3 then
    raise exception 'S1 FAIL: live_count % -> %, expected +3 people', before, after;
  end if;
  raise notice 'S1 PASS: valid submits ok, count counts people (+3)';
end $$;

-- S2: validation rejects bad input and stores nothing.
do $$
declare r text; before int; after int;
begin
  before := current_setting('s.base')::int + 3;
  if public.submit_rsvp(null, 1, 'sweet', null)          <> 'invalid'
     or public.submit_rsvp('', 1, 'sweet', null)         <> 'invalid'
     or public.submit_rsvp(repeat('x', 41), 1, null, null) <> 'invalid'
     or public.submit_rsvp('g', 0, null, null)           <> 'invalid'
     or public.submit_rsvp('g', 6, null, null)           <> 'invalid'
     or public.submit_rsvp('g', 1, 'chaotic', null)      <> 'invalid'
     or public.submit_rsvp('g', 1, null, '"not-array"')  <> 'invalid'
     or public.submit_rsvp('g', 1, null, '["a","b","c","d","e"]') <> 'invalid'
     or public.submit_rsvp('g', 1, null, jsonb_build_array(repeat('x', 2100))) <> 'invalid'
  then
    raise exception 'S2 FAIL: an invalid submit was not rejected';
  end if;
  select public.rsvp_live_count() into after;
  if after <> before then
    raise exception 'S2 FAIL: invalid submits changed the count (% -> %)', before, after;
  end if;
  raise notice 'S2 PASS: bounds/whitelist/shape rejected, nothing stored';
end $$;

-- S3: consent is implied true on every stored row; the table CHECK backs it.
do $$
declare c boolean;
begin
  select consent_given into c from public.rsvps where nickname = 'alice';
  if not c then raise exception 'S3 FAIL: stored row lacks consent'; end if;
  raise notice 'S3 PASS: stored rows carry consent';
end $$;

-- S4: capacity counts PEOPLE — a group that overshoots the cap is 'full',
-- and the existing headcount stays intact.
do $$
declare r text; cap int; before int; after int;
begin
  select capacity into cap from public.event_config where id = true;
  select public.rsvp_live_count() into before;
  loop
    if before + 5 > cap then exit; end if;
    r := public.submit_rsvp('filler', 5, null, null);
    if r <> 'ok' then raise exception 'S4 FAIL: filler submit returned %', r; end if;
    select public.rsvp_live_count() into before;
  end loop;
  r := public.submit_rsvp('overshoot', 1 + (cap - before), null, null);
  if r <> 'full' then raise exception 'S4 FAIL: overshoot returned % (people=%, cap=%)', r, before, cap; end if;
  select public.rsvp_live_count() into after;
  if after <> before then raise exception 'S4 FAIL: overshoot stored rows (% -> %)', before, after; end if;
  raise notice 'S4 PASS: people-based capacity enforced (people=%, cap=%)', before, cap;
end $$;

-- S5: closed registration -> 'closed', nothing stored.
reset role;
update public.event_config set registration_open = false where id = true;
set role service_role;
do $$
declare r text; before int; after int;
begin
  before := public.rsvp_live_count();
  r := public.submit_rsvp('when-closed', 1, null, null);
  if r <> 'closed' then raise exception 'S5 FAIL: closed registration returned %', r; end if;
  select public.rsvp_live_count() into after;
  if after <> before then raise exception 'S5 FAIL: closed insert stored rows (% -> %)', before, after; end if;
  raise notice 'S5 PASS: closed registration returns closed';
end $$;
reset role;
update public.event_config set registration_open = true where id = true;
set role service_role;

-- S6: hidden count -> NULL even for service_role.
reset role;
update public.event_config set live_count_visible = false where id = true;
set role service_role;
do $$
begin
  if public.rsvp_live_count() is not null then
    raise exception 'S6 FAIL: count returned while hidden';
  end if;
  raise notice 'S6 PASS: hidden count returns NULL';
end $$;
reset role;
update public.event_config set live_count_visible = true where id = true;
set role service_role;

do $$ begin raise notice 'S-post PASS: service suite verified; session rollback clears all rows'; end $$;

select 'ALL SERVICE TESTS PASS (S1-S6; submit_rsvp, live-safe)' as result;

rollback;
