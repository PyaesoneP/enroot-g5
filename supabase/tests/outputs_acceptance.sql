-- Acceptance tests for saved outputs / the gallery (issue #16, 0013).
-- Pure SQL, fully rolled back, owners prefixed "test-" — re-runnable on the
-- live schema:  supabase db query --linked -f supabase/tests/outputs_acceptance.sql

reset role;
begin;

-- O1: anon / authenticated cannot touch outputs; charm_picks is gone.
-- Privileges asserted directly (a failed write alone could be RLS).
do $$
declare r text; p text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege(r, 'public.outputs', p) then
        raise exception 'O1 FAIL: % holds % on outputs', r, p;
      end if;
    end loop;
  end loop;
  foreach p in array array['INSERT', 'UPDATE', 'TRUNCATE'] loop
    if has_table_privilege('service_role', 'public.outputs', p) then
      raise exception 'O1 FAIL: service_role holds % on outputs', p;
    end if;
  end loop;
end $$;
set role anon;
do $$
begin
  begin
    perform public.output_save('test-owner-anon-xxxxxxxx', 'charm-builder', 'c27@0');
    raise exception 'O1 FAIL: anon executed output_save';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.output_list(null, null, 10);
    raise exception 'O1 FAIL: anon executed output_list';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.output_delete('test-owner-anon-xxxxxxxx', gen_random_uuid());
    raise exception 'O1 FAIL: anon executed output_delete';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.output_activities();
    raise exception 'O1 FAIL: anon executed output_activities';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.outputs limit 1;
    raise exception 'O1 FAIL: anon read outputs';
  exception when insufficient_privilege then null;
  end;
  if to_regclass('public.charm_picks') is not null then
    raise exception 'O1 FAIL: charm_picks still exists';
  end if;
  raise notice 'O1 PASS: no anon/authenticated privileges, no service_role writes; charm_picks dropped';
end $$;
reset role;

select set_config('o.base', (select count(*) from public.outputs)::text, false);
set role service_role;

-- O2: save returns an id; the same owner + payload again returns the same id.
do $$
declare a uuid; b uuid; c uuid;
begin
  a := public.output_save('test-owner-a-aaaaaaaaaaaa', 'charm-builder', 'c27@0,c30@1,c55@2,c85@3');
  b := public.output_save('test-owner-a-aaaaaaaaaaaa', 'charm-builder', 'c27@0,c30@1,c55@2,c85@3');
  c := public.output_save('test-owner-b-bbbbbbbbbbbb', 'charm-builder', 'c27@0,c30@1,c55@2,c85@3');
  if a is null or a <> b then raise exception 'O2 FAIL: duplicate save gave % then %', a, b; end if;
  if c is null or c = a then raise exception 'O2 FAIL: another owner''s identical save not separate'; end if;
  perform set_config('o.a', a::text, false);
  perform set_config('o.c', c::text, false);
  raise notice 'O2 PASS: save returns id; duplicate save is idempotent per owner';
end $$;

-- O3: bounds rejected (NULL), nothing stored.
do $$
declare before int; after int;
begin
  select count(*) into before from public.outputs;
  if public.output_save('short', 'charm-builder', 'x') is not null then raise exception 'O3 FAIL: short owner'; end if;
  if public.output_save('test-owner-a-aaaaaaaaaaaa', 'Bad Id!', 'x') is not null then raise exception 'O3 FAIL: bad activity id'; end if;
  if public.output_save('test-owner-a-aaaaaaaaaaaa', 'charm-builder', '') is not null then raise exception 'O3 FAIL: empty payload'; end if;
  if public.output_save('test-owner-a-aaaaaaaaaaaa', 'charm-builder', repeat('x', 513)) is not null then raise exception 'O3 FAIL: 513-char payload'; end if;
  if public.output_save(null, 'charm-builder', 'x') is not null then raise exception 'O3 FAIL: null owner'; end if;
  select count(*) into after from public.outputs;
  if after <> before then raise exception 'O3 FAIL: % rows stored', after - before; end if;
  raise notice 'O3 PASS: bad owner / activity id / payload rejected, nothing stored';
end $$;

-- O4: a row from a retired module still lists; the activity filter works.
do $$
declare n int;
begin
  perform set_config('o.old',
    public.output_save('test-owner-a-aaaaaaaaaaaa', 'retired-module', 'whatever-v0')::text, false);
  select count(*) into n from public.output_list(null, null, 200)
   where id = current_setting('o.old')::uuid;
  if n <> 1 then raise exception 'O4 FAIL: retired-module row not listed'; end if;
  select count(*) into n from public.output_list(null, 'charm-builder', 200) where activity_id <> 'charm-builder';
  if n <> 0 then raise exception 'O4 FAIL: activity filter leaked % rows', n; end if;
  select count(*) into n from public.output_list(null, 'retired-module', 200);
  if n < 1 then raise exception 'O4 FAIL: filter by retired-module empty'; end if;
  if not exists (select 1 from public.output_activities() a where a = 'retired-module') then
    raise exception 'O4 FAIL: output_activities missing retired-module';
  end if;
  raise notice 'O4 PASS: old module rows list; filter by activity works';
end $$;

-- O5: mine only for the owner; owner_hash never returned.
do $$
declare m int;
begin
  select count(*) into m from public.output_list('test-owner-a-aaaaaaaaaaaa', null, 200)
   where mine and id = current_setting('o.c')::uuid;
  if m <> 0 then raise exception 'O5 FAIL: A sees B''s row as mine'; end if;
  select count(*) into m from public.output_list('test-owner-a-aaaaaaaaaaaa', null, 200)
   where mine and id = current_setting('o.a')::uuid;
  if m <> 1 then raise exception 'O5 FAIL: A does not see own row as mine'; end if;
  select count(*) into m from public.output_list(null, null, 200) where mine;
  if m <> 0 then raise exception 'O5 FAIL: anonymous list marked rows mine'; end if;
  begin
    perform owner_hash from public.output_list(null, null, 1);
    raise exception 'O5 FAIL: output_list returns owner_hash';
  exception when undefined_column then null;
  end;
  raise notice 'O5 PASS: mine only for the owner, owner_hash not returned';
end $$;

-- O6: only the owner can delete.
do $$
begin
  if public.output_delete('test-owner-b-bbbbbbbbbbbb', current_setting('o.a')::uuid) then
    raise exception 'O6 FAIL: stranger deleted someone else''s output';
  end if;
  if public.output_delete(null, current_setting('o.a')::uuid) then
    raise exception 'O6 FAIL: null owner deleted';
  end if;
  if public.output_delete('test-owner-a-aaaaaaaaaaaa', gen_random_uuid()) then
    raise exception 'O6 FAIL: unknown id reported deleted';
  end if;
  if not public.output_delete('test-owner-a-aaaaaaaaaaaa', current_setting('o.a')::uuid) then
    raise exception 'O6 FAIL: owner could not delete';
  end if;
  raise notice 'O6 PASS: stranger/null/unknown rejected, owner delete works';
end $$;

-- O7: limit clamped (0 -> 1 row).
do $$
declare n int;
begin
  select count(*) into n from public.output_list(null, null, 0);
  if n <> 1 then raise exception 'O7 FAIL: limit 0 returned % rows', n; end if;
  raise notice 'O7 PASS: limit clamped';
end $$;

-- post: net change = the two surviving test rows (B's, retired-module).
reset role;
do $$
begin
  if (select count(*) from public.outputs) <> current_setting('o.base')::int + 2 then
    raise exception 'post FAIL: unexpected row delta';
  end if;
end $$;

select 'ALL OUTPUTS TESTS PASS (O1-O7; rolled back, live-safe)' as result;
rollback;
