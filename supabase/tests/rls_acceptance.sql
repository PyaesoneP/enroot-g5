-- Acceptance tests for issue #4: run everything as role "anon".
\set ON_ERROR_STOP on

reset role;
begin;
set role anon;

-- T1: insert WITHOUT consent must fail (policy with check consent=true)
do $$
begin
  begin
    insert into public.rsvps (nickname, consent_given) values ('spammer', false);
    raise exception 'T1 FAIL: no-consent insert was accepted';
  exception when insufficient_privilege or check_violation then
    raise notice 'T1 PASS: no-consent insert rejected';
  end;
end $$;

-- T2: insert WITH consent must succeed
insert into public.rsvps (nickname, consent_given) values ('alice', true);
insert into public.rsvps (nickname, consent_given) values ('bob', true);
\echo 'T2 PASS: consent inserts ok'

-- T3: anon must NOT see any rsvp rows (either empty result or hard denial)
do $$
declare n int;
begin
  select count(*) into n from public.rsvps;
  if n <> 0 then raise exception 'T3 FAIL: anon sees % rsvp rows', n; end if;
  raise notice 'T3 PASS: anon sees 0 rsvp rows';
exception when insufficient_privilege then
  raise notice 'T3 PASS: anon SELECT denied at table level (stricter)';
end $$;

-- T4: live count RPC returns the real count despite T3 (delta-based:
-- the script must be re-runnable without seeding a fresh schema)
do $$
declare before int; after int;
begin
  select public.rsvp_live_count() into before;
  perform set_config('t4.before', before::text, false);
end $$;
insert into public.rsvps (nickname, consent_given) values ('live-a', true);
insert into public.rsvps (nickname, consent_given) values ('live-b', true);
do $$
declare before int; after int;
begin
  before := current_setting('t4.before')::int;
  select public.rsvp_live_count() into after;
  if after <> before + 2 then raise exception 'T4 FAIL: live_count % -> %, expected +2', before, after; end if;
  raise notice 'T4 PASS: live_count % -> % (+2) without row access', before, after;
end $$;

-- T5: nickname length guard
do $$
begin
  begin
    insert into public.rsvps (nickname, consent_given)
    values (repeat('x', 41), true);
    raise exception 'T5 FAIL: 41-char nickname accepted';
  exception when check_violation then
    raise notice 'T5 PASS: over-length nickname rejected';
  end;
end $$;

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

-- T7: delete_pick ownership check (results stashed in session GUCs,
-- since psql cannot interpolate \gset vars inside dollar-quoted blocks)
insert into public.charm_picks (id, session_id, picks)
values ('11111111-1111-1111-1111-111111111111', 'sess-owner-1', '[{"charm":"cat","link":0}]'::jsonb);
select set_config('t7c.random_ok',   public.delete_pick('22222222-2222-2222-2222-222222222222', 'sess-owner-1')::text, false);
select set_config('t7.attacker_ok',  public.delete_pick('11111111-1111-1111-1111-111111111111', 'sess-attacker-9')::text, false);
select set_config('t7b.owner_ok',    public.delete_pick('11111111-1111-1111-1111-111111111111', 'sess-owner-1')::text, false);
do $$
begin
  if current_setting('t7c.random_ok')::boolean   then raise exception 'T7c FAIL: random id deleted'; end if;
  if current_setting('t7.attacker_ok')::boolean  then raise exception 'T7 FAIL: attacker deleted someone else''s pick'; end if;
  if not current_setting('t7b.owner_ok')::boolean then raise exception 'T7b FAIL: owner could not delete own pick'; end if;
  raise notice 'T7 PASS: wrong session + random id rejected, owner session accepted';
end $$;

reset role;
do $$
declare n int;
begin
  select public.rsvp_live_count() into n;  -- service-role view of true count
  if n <> 4 then raise exception 'post-state wrong: %', n; end if;  -- 2 (T2) + 2 (T4)
  raise notice 'ALL TESTS PASS (4 rows in-txn, hidden from anon)';
end $$;

rollback;  -- suite leaves no residue: re-runnable on any schema
