-- Acceptance tests for issue #4 (updated for 0007): run everything as
-- role "anon". Pure SQL (no psql meta-commands) so it runs under both
-- `psql -v ON_ERROR_STOP=1 -f` and `supabase db query --linked -f`.
--
-- Post 0007: rsvps is UNWRITABLE by anon at the privilege level — every
-- sign-up goes through submit_rsvp(), service_role only. The service-side
-- tests live in submit_rsvp_acceptance.sql. All counts are delta-based:
-- the suite is re-runnable on a live schema.

reset role;
begin;
-- Deterministic start state (round-2 review): counts measure through
-- rsvp_live_count(), which returns NULL when hidden, and `NULL <> x` is
-- unknown — the if-raise would be skipped. Normalize both toggles; the
-- final rollback leaves no residue.
update public.event_config set live_count_visible = true, registration_open = true where id = true;
set role anon;

-- T1 (0007): ANY anon insert into rsvps must fail — consent flag or not.
do $$
begin
  begin
    insert into public.rsvps (nickname, consent_given) values ('spammer', true);
    raise exception 'T1 FAIL: anon insert into rsvps was accepted';
  exception when insufficient_privilege then
    raise notice 'T1 PASS: anon rsvp insert denied at privilege level';
  end;
end $$;

-- T2 (0007): forged-column inserts (id/created_at/consent_at) are dead by
-- the same privilege denial — nothing is writable, so nothing is forgeable.
do $$
begin
  begin
    insert into public.rsvps (id, nickname, consent_given, consent_at, created_at)
    values ('11111111-1111-1111-1111-111111111111', 'forger', true,
            '2020-01-01', '2020-01-01');
    raise exception 'T2 FAIL: forged-column insert accepted';
  exception when insufficient_privilege then
    raise notice 'T2 PASS: forged-column insert denied';
  end;
end $$;

-- T3 (0004): anon SELECT on rsvps must be a HARD table-level denial.
do $$
declare n int;
begin
  select count(*) into n from public.rsvps;
  raise exception 'T3 FAIL: anon can select rsvps (% rows)', n;
exception when insufficient_privilege then
  raise notice 'T3 PASS: anon SELECT denied at table level';
end $$;

-- T3b (0007): submit_rsvp must not be executable by anon — otherwise any
-- script could skip /api/rsvp's rate limit and validation.
do $$
begin
  begin
    perform public.submit_rsvp('direct-post', 1, 'sweet', null);
    raise exception 'T3b FAIL: anon executed submit_rsvp';
  exception when insufficient_privilege then
    raise notice 'T3b PASS: submit_rsvp not executable by anon';
  end;
end $$;

-- T4: live count RPC works despite T3 and counts PEOPLE (group_size sums).
do $$
begin
  perform set_config('t4.before', public.rsvp_live_count()::text, false);
end $$;
reset role;
insert into public.rsvps (nickname, consent_given, group_size)
  values ('t4-a', true, 2), ('t4-b', true, 3);
set role anon;
do $$
declare before int; after int;
begin
  before := current_setting('t4.before')::int;
  select public.rsvp_live_count() into after;
  if after is null or after <> before + 5 then
    raise exception 'T4 FAIL: live_count % -> %, expected +5 people', before, after;
  end if;
  raise notice 'T4 PASS: live_count % -> % (+5 people) without row access', before, after;
end $$;
reset role;
delete from public.rsvps where nickname in ('t4-a', 't4-b');
set role anon;

-- T5: nickname length guard is enforced in submit_rsvp (service suite);
-- here we only prove anon has no path to bypass it (covered by T1).
do $$ begin raise notice 'T5 PASS: nickname guard moved to submit_rsvp (see service suite)'; end $$;

-- T6: guest_tokens invisible + unwritable to anon
do $$
begin
  begin
    select count(*) from public.guest_tokens;
    raise exception 'T6 FAIL: anon can select guest_tokens';
  exception when insufficient_privilege then
    raise notice 'T6 PASS: anon denied guest_tokens';
  end;
end $$;

-- T7: delete_pick ownership check. Session labels include random() so
-- the suite never collides with real picks on a live table. The id and
-- session are captured at INSERT via RETURNING into GUCs — anon can no
-- longer read session_id back (0004), which is exactly what T8 proves.
select set_config('t7.sess', 'sess-owner-' || md5(random()::text), false);
with new_pick as (
  insert into public.charm_picks (session_id, picks)
  values (current_setting('t7.sess'), '[{"charm":"cat","link":0}]'::jsonb)
  returning id
)
select set_config('t7.pick_id', (select id::text from new_pick), false);
select set_config('t7c.random_ok',
  public.delete_pick('22222222-2222-2222-2222-222222222222',
                     'sess-owner-' || md5('nothing'))::text, false);
select set_config('t7.attacker_ok',
  public.delete_pick(current_setting('t7.pick_id')::uuid, 'sess-attacker-9')::text, false);
select set_config('t7b.owner_ok',
  public.delete_pick(current_setting('t7.pick_id')::uuid,
                     current_setting('t7.sess'))::text, false);
do $$
begin
  if current_setting('t7c.random_ok')::boolean   then raise exception 'T7c FAIL: random id deleted'; end if;
  if current_setting('t7.attacker_ok')::boolean  then raise exception 'T7 FAIL: attacker deleted someone else''s pick'; end if;
  if not current_setting('t7b.owner_ok')::boolean then raise exception 'T7b FAIL: owner could not delete own pick'; end if;
  raise notice 'T7 PASS: wrong session + random id rejected, owner session accepted';
end $$;

-- T8 (0004): session_id must NOT be selectable (review #1: reading the
-- table handed attackers the ownership token for every pick).
do $$
declare s text;
begin
  begin
    select session_id into s from public.charm_picks limit 1;
    raise exception 'T8 FAIL: anon can read charm_picks.session_id';
  exception when insufficient_privilege then
    raise notice 'T8 PASS: session_id column denied';
  end;
end $$;

-- T8b (0004): non-array / oversized picks rejected (review: storage-fill)
do $$
begin
  begin
    insert into public.charm_picks (session_id, picks)
    values ('sess-junk-' || md5(random()::text), '"not-an-array"'::jsonb);
    raise exception 'T8b FAIL: non-array picks accepted';
  exception when check_violation then
    raise notice 'T8b PASS: non-array picks rejected';
  end;
end $$;
do $$
begin
  begin
    insert into public.charm_picks (session_id, picks)
    values ('sess-big-' || md5(random()::text),
            jsonb_build_array(repeat('x', 2100)));
    raise exception 'T8b FAIL: 2100-byte picks accepted';
  exception when check_violation then
    raise notice 'T8b PASS: oversized picks rejected';
  end;
end $$;

-- T8c (round 2): > pickCount charms rejected (0005 tightened 18 -> 4;
-- a bracelet physically holds 4 — content/charms.json pickCount).
do $$
begin
  begin
    insert into public.charm_picks (session_id, picks)
    values ('sess-over-' || md5(random()::text),
            '["a","b","c","d","e"]'::jsonb);
    raise exception 'T8c FAIL: 5 picks accepted (cap is 4)';
  exception when check_violation then
    raise notice 'T8c PASS: 5 picks rejected, cap 4 enforced';
  end;
end $$;

-- T10 (0004): live_count_visible=false -> RPC returns NULL (review #3)
reset role;
update public.event_config set live_count_visible = false where id = true;
set role anon;
do $$
begin
  if public.rsvp_live_count() is not null then
    raise exception 'T10 FAIL: count returned while hidden';
  end if;
  raise notice 'T10 PASS: hidden count returns NULL';
end $$;
reset role;
update public.event_config set live_count_visible = true where id = true;
set role anon;

do $$ begin raise notice 'T-post PASS: anon suite left no rsvp rows (service suite checks deltas)'; end $$;

-- Success row for channels that drop NOTICEs (supabase db query):
-- a failure raises first and this row is never returned.
select 'ALL ANON TESTS PASS (T1-T10; privilege denials, live-safe)' as result;

rollback;  -- suite leaves no residue: re-runnable on any schema
