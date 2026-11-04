-- Acceptance tests for the friendship wall (issue #14, 0011).
-- Pure SQL, fully rolled back, owners prefixed "test-" — re-runnable on the
-- live schema:  supabase db query --linked -f supabase/tests/wall_acceptance.sql

reset role;
begin;
update public.event_config set wall_open = true where id = true;

-- W1: anon / authenticated cannot touch the wall at all. The privilege is
-- asserted directly: a failed INSERT alone could also be RLS (same 42501),
-- which would hide a grant regression (PR #41 review, finding 2).
do $$
declare r text; p text;
begin
  foreach r in array array['anon', 'authenticated'] loop
    foreach p in array array['SELECT', 'INSERT', 'UPDATE', 'DELETE', 'TRUNCATE'] loop
      if has_table_privilege(r, 'public.wall_posts', p) then
        raise exception 'W1 FAIL: % holds % on wall_posts', r, p;
      end if;
    end loop;
  end loop;
  -- 0012: service_role reads and deletes (ops) but cannot write rows that
  -- skip wall_post()'s checks.
  foreach p in array array['INSERT', 'UPDATE', 'TRUNCATE'] loop
    if has_table_privilege('service_role', 'public.wall_posts', p) then
      raise exception 'W1 FAIL: service_role holds % on wall_posts', p;
    end if;
  end loop;
end $$;
set role anon;
do $$
begin
  begin
    perform * from public.wall_post('test-owner-anon-xxxxxxxx', null, 'hi');
    raise exception 'W1 FAIL: anon executed wall_post';
  exception when insufficient_privilege then null;
  end;
  begin
    perform * from public.wall_list(null, 10);
    raise exception 'W1 FAIL: anon executed wall_list';
  exception when insufficient_privilege then null;
  end;
  begin
    perform public.wall_delete('test-owner-anon-xxxxxxxx', gen_random_uuid());
    raise exception 'W1 FAIL: anon executed wall_delete';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.wall_posts limit 1;
    raise exception 'W1 FAIL: anon read wall_posts';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.wall_posts (owner_hash, body) values ('test-owner-anon-xxxxxxxx', 'direct');
    raise exception 'W1 FAIL: anon inserted into wall_posts';
  exception when insufficient_privilege then null;
  end;
  raise notice 'W1 PASS: no anon/authenticated table privileges, no service_role writes; anon cannot post, list, delete, read or insert';
end $$;
reset role;

select set_config('w.base', (select count(*) from public.wall_posts)::text, false);
set role service_role;

-- W2: valid posts are stored, with and without a name, at the bounds.
do $$
declare r record;
begin
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', 'Mei', 'Happy to be here!');
  if r.status <> 'ok' or r.id is null then raise exception 'W2 FAIL: named post -> %', r.status; end if;
  perform set_config('w.a1', r.id::text, false);
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', null, 'No name this time');
  if r.status <> 'ok' then raise exception 'W2 FAIL: unnamed post -> %', r.status; end if;
  select * into r from public.wall_post('test-owner-b-bbbbbbbbbbbb', repeat('n', 40), repeat('x', 280));
  if r.status <> 'ok' then raise exception 'W2 FAIL: 40-char name / 280-char body -> %', r.status; end if;
  perform set_config('w.b1', r.id::text, false);
  raise notice 'W2 PASS: named, unnamed and boundary-length posts stored';
end $$;

-- W3: bounds are re-checked in the database; nothing is stored.
do $$
declare r record; before int; after int;
begin
  select count(*) into before from public.wall_posts;
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', null, '');
  if r.status <> 'invalid' then raise exception 'W3 FAIL: empty body -> %', r.status; end if;
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', null, '   ');
  if r.status <> 'invalid' then raise exception 'W3 FAIL: blank body -> %', r.status; end if;
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', null, repeat('x', 281));
  if r.status <> 'invalid' then raise exception 'W3 FAIL: 281-char body -> %', r.status; end if;
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', null, null);
  if r.status <> 'invalid' then raise exception 'W3 FAIL: null body -> %', r.status; end if;
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', repeat('n', 41), 'hi');
  if r.status <> 'invalid' then raise exception 'W3 FAIL: 41-char name -> %', r.status; end if;
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', ' ', 'hi');
  if r.status <> 'invalid' then raise exception 'W3 FAIL: blank name -> %', r.status; end if;
  select * into r from public.wall_post('short', null, 'hi');
  if r.status <> 'invalid' then raise exception 'W3 FAIL: short owner -> %', r.status; end if;
  select * into r from public.wall_post(null, null, 'hi');
  if r.status <> 'invalid' then raise exception 'W3 FAIL: null owner -> %', r.status; end if;
  select count(*) into after from public.wall_posts;
  if after <> before then raise exception 'W3 FAIL: % rows stored by rejected posts', after - before; end if;
  raise notice 'W3 PASS: empty/blank/281-char body, 41-char/blank name, bad owner rejected';
end $$;

-- W4: the list marks only the caller's own posts and never exposes the owner.
do $$
declare mine_a int; others_a int; mine_none int;
begin
  select count(*) filter (where mine), count(*) filter (where not mine)
    into mine_a, others_a
    from public.wall_list('test-owner-a-aaaaaaaaaaaa', 200)
   where id in (current_setting('w.a1')::uuid, current_setting('w.b1')::uuid);
  if mine_a <> 1 or others_a <> 1 then
    raise exception 'W4 FAIL: owner A sees mine=% others=% (expected 1/1)', mine_a, others_a;
  end if;
  select count(*) into mine_none from public.wall_list(null, 200) where mine;
  if mine_none <> 0 then raise exception 'W4 FAIL: no-owner list marked % posts mine', mine_none; end if;
  begin
    perform owner_hash from public.wall_list('test-owner-a-aaaaaaaaaaaa', 10);
    raise exception 'W4 FAIL: wall_list returns owner_hash';
  exception when undefined_column then null;
  end;
  raise notice 'W4 PASS: mine only for the owner, owner_hash not returned';
end $$;

-- W5: only the owner can delete; strangers, unknown ids and no owner get false.
do $$
declare ok boolean;
begin
  select public.wall_delete('test-owner-b-bbbbbbbbbbbb', current_setting('w.a1')::uuid) into ok;
  if ok then raise exception 'W5 FAIL: stranger deleted someone else''s post'; end if;
  select public.wall_delete(null, current_setting('w.a1')::uuid) into ok;
  if ok then raise exception 'W5 FAIL: null owner deleted a post'; end if;
  select public.wall_delete('test-owner-a-aaaaaaaaaaaa', gen_random_uuid()) into ok;
  if ok then raise exception 'W5 FAIL: unknown id reported deleted'; end if;
  if not exists (select 1 from public.wall_list(null, 200) where id = current_setting('w.a1')::uuid) then
    raise exception 'W5 FAIL: post gone after rejected deletes';
  end if;
  select public.wall_delete('test-owner-a-aaaaaaaaaaaa', current_setting('w.a1')::uuid) into ok;
  if not ok then raise exception 'W5 FAIL: owner could not delete own post'; end if;
  if exists (select 1 from public.wall_list(null, 200) where id = current_setting('w.a1')::uuid) then
    raise exception 'W5 FAIL: post still listed after owner delete';
  end if;
  raise notice 'W5 PASS: stranger/null/unknown rejected, owner delete works';
end $$;

-- W6: wall_open = false closes posting (and stores nothing).
reset role;
update public.event_config set wall_open = false where id = true;
set role service_role;
do $$
declare r record;
begin
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', null, 'while closed');
  if r.status <> 'closed' then raise exception 'W6 FAIL: closed wall returned %', r.status; end if;
  if exists (select 1 from public.wall_list(null, 200) where body = 'while closed') then
    raise exception 'W6 FAIL: closed wall stored the post';
  end if;
  raise notice 'W6 PASS: wall_open = false -> closed';
end $$;

-- W7: a missing config row fails closed (0008 precedent).
reset role;
delete from public.event_config where id = true;
set role service_role;
do $$
declare r record;
begin
  select * into r from public.wall_post('test-owner-a-aaaaaaaaaaaa', null, 'no config');
  if r.status <> 'closed' then raise exception 'W7 FAIL: missing config returned %', r.status; end if;
  raise notice 'W7 PASS: missing config fails closed';
end $$;

-- W8: the list limit is clamped (0 -> 1 row; null -> default).
do $$
declare n int;
begin
  select count(*) into n from public.wall_list(null, 0);
  if n <> 1 then raise exception 'W8 FAIL: limit 0 returned % rows, expected 1', n; end if;
  select count(*) into n from public.wall_list(null, null);
  if n < 1 or n > 100 then raise exception 'W8 FAIL: null limit returned % rows', n; end if;
  raise notice 'W8 PASS: limit clamped';
end $$;

-- post: net table change is exactly the two surviving test posts.
reset role;
do $$
begin
  if (select count(*) from public.wall_posts) <> current_setting('w.base')::int + 2 then
    raise exception 'post FAIL: unexpected row delta';
  end if;
end $$;

select 'ALL WALL TESTS PASS (W1-W8; rolled back, live-safe)' as result;
rollback;
