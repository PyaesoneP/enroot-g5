-- Acceptance tests for issue #4: run everything as role "anon".
-- Pure SQL (no psql meta-commands) so it runs under both
-- `psql -v ON_ERROR_STOP=1 -f` and `supabase db query --linked -f`.
--
-- Post 0004: anon has NO select privilege on rsvps (table-level denial,
-- not just RLS), session_id is column-revoked on charm_picks, inserts
-- are gated by registration_open + capacity, and picks are shape-bound.
-- All counts are delta-based: the suite is re-runnable on a live schema.

reset role;
begin;
-- Deterministic start state (round-2 review): T4/T9/post-state measure
-- through rsvp_live_count(), which returns NULL when hidden, and
-- `NULL <> x` is unknown — the if-raise is skipped and a wrongly
-- ACCEPTED insert would print PASS. Normalize both toggles; the final
-- rollback leaves no residue.
update public.event_config set live_count_visible = true, registration_open = true where id = true;
set role anon;

select set_config('t.base', public.rsvp_live_count()::text, false);

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
do $$ begin raise notice 'T2 PASS: consent inserts ok'; end $$;

-- T3 (0004): anon SELECT on rsvps must be a HARD table-level denial.
-- The old suite also passed on an empty result set, which hid the fact
-- that Supabase default grants still handed anon SELECT (review #5).
do $$
declare n int;
begin
  select count(*) into n from public.rsvps;
  raise exception 'T3 FAIL: anon can select rsvps (% rows)', n;
exception when insufficient_privilege then
  raise notice 'T3 PASS: anon SELECT denied at table level';
end $$;

-- T4: live count RPC returns the real count despite T3 (delta-based)
do $$
begin
  perform set_config('t4.before', public.rsvp_live_count()::text, false);
end $$;
insert into public.rsvps (nickname, consent_given) values ('live-a', true);
insert into public.rsvps (nickname, consent_given) values ('live-b', true);
do $$
declare before int; after int;
begin
  before := current_setting('t4.before')::int;
  select public.rsvp_live_count() into after;
  if after is null or after <> before + 2 then
    raise exception 'T4 FAIL: live_count % -> %, expected +2', before, after;
  end if;
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

-- T9 (0004): closed registration rejects inserts (review #2). Toggle as
-- postgres; anon cannot write event_config anyway, so this also proves it.
reset role;
update public.event_config set registration_open = false where id = true;
set role anon;
do $$
declare before int; after int;
begin
  select public.rsvp_live_count() into before;  -- sample HERE (T2/T4
  begin                                          -- already added rows)
    insert into public.rsvps (nickname, consent_given) values ('when-closed', true);
  exception when insufficient_privilege or check_violation then
    null;
  end;
  select public.rsvp_live_count() into after;
  if after is null or after <> before then
    raise exception 'T9 FAIL: insert accepted while registration closed (% -> %)', before, after;
  end if;
  raise notice 'T9 PASS: closed registration blocks inserts';
end $$;
reset role;
update public.event_config set registration_open = true where id = true;
set role anon;

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

-- post-state: delta-based (review #4: absolute counts break once real
-- guests RSVP). t.base was sampled at top of this txn; net effect of
-- the suite is exactly +4 rsvp rows (T2 x2, T4 x2).
do $$
declare base int; now_ int;
begin
  base := current_setting('t.base')::int;
  select public.rsvp_live_count() into now_;
  if now_ is null or now_ <> base + 4 then
    raise exception 'post-state wrong: base=%, now=%, expected base+4', base, now_;
  end if;
end $$;

-- Success row for channels that drop NOTICEs (supabase db query):
-- a failure raises first and this row is never returned.
select 'ALL TESTS PASS (T1-T10 + post-state; delta-based, live-safe)' as result;

rollback;  -- suite leaves no residue: re-runnable on any schema
