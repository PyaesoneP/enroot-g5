-- Issue #14: the friendship wall. Post a short message (280 chars, name
-- optional), read everyone's, delete your own. No accounts (ADR-008).
--
-- Same posture as sign-ups (0007) and the limiter (0009): no grants to
-- anon/authenticated at all. The Next server calls three SECURITY DEFINER
-- functions with the service-role key (src/lib/db.ts), after its own
-- validation, stop-word filter and rate limit (ADR-009). The functions
-- re-check the bounds, so the table cannot hold an oversized post whoever
-- writes to it.
--
-- Ownership: owner_hash is an HMAC of the poster's g5_guest cookie (key
-- server-side, src/lib/rate-limit-keys.ts). It is never returned to
-- clients; wall_list() only says whether a post is the caller's own.
--
-- Retention (PDPA, doc 05): posts are public and may carry a name, so the
-- table is emptied by 19 Dec together with rsvps.

-- Kill switch for posting, flipped by the organiser in the Table Editor.
-- Open by default: the wall goes live when it ships (team, 2026-11-04).
alter table public.event_config
  add column wall_open boolean not null default true;

create table public.wall_posts (
  id         uuid        primary key default gen_random_uuid(),
  owner_hash text        not null check (char_length(owner_hash) between 20 and 128),
  name       text        check (name is null or char_length(name) between 1 and 40),
  body       text        not null check (char_length(body) between 1 and 280),
  created_at timestamptz not null default now()
);

create index wall_posts_created_at_idx on public.wall_posts (created_at desc);

alter table public.wall_posts enable row level security;
revoke all on table public.wall_posts from public, anon, authenticated;
-- Ops only (export / the 19 Dec purge from a service-role script). Writes
-- go through wall_post(), so service_role gets no INSERT/UPDATE.
grant select, delete on table public.wall_posts to service_role;

-- Stores one post. 'invalid' = bounds failed (the route checks first, so
-- it should not happen), 'closed' = wall_open is off or the config row is
-- missing (fails closed, 0008 precedent).
create or replace function public.wall_post(
  p_owner text,
  p_name  text,
  p_body  text
)
returns table (status text, id uuid)
language plpgsql
security definer
set search_path = public
as $$
declare
  open_  boolean;
  new_id uuid;
begin
  if p_owner is null or char_length(p_owner) not between 20 and 128 then
    return query select 'invalid'::text, null::uuid; return;
  end if;
  if p_name is not null and (char_length(p_name) not between 1 and 40 or p_name !~ '\S') then
    return query select 'invalid'::text, null::uuid; return;
  end if;
  if p_body is null or char_length(p_body) not between 1 and 280 or p_body !~ '\S' then
    return query select 'invalid'::text, null::uuid; return;
  end if;

  select e.wall_open into open_ from public.event_config e where e.id = true;
  if open_ is null or not open_ then
    return query select 'closed'::text, null::uuid; return;
  end if;

  insert into public.wall_posts (owner_hash, name, body)
    values (p_owner, p_name, p_body)
    returning wall_posts.id into new_id;
  return query select 'ok'::text, new_id;
end $$;

-- Newest first. `mine` is true only for the caller's own posts; the owner
-- hash itself never leaves the database. Limit clamped to 1..200.
create or replace function public.wall_list(
  p_owner text,
  p_limit integer
)
returns table (id uuid, name text, body text, created_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select w.id, w.name, w.body, w.created_at,
         coalesce(p_owner is not null and w.owner_hash = p_owner, false)
    from public.wall_posts w
   order by w.created_at desc, w.id
   limit greatest(1, least(coalesce(p_limit, 100), 200));
$$;

-- Deletes a post only if the caller owns it. False for someone else's post,
-- an unknown id, or a missing owner: the route answers 404 for all three.
create or replace function public.wall_delete(
  p_owner text,
  p_id    uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare n integer;
begin
  if p_owner is null or p_id is null then
    return false;
  end if;
  delete from public.wall_posts w where w.id = p_id and w.owner_hash = p_owner;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Supabase grants EXECUTE on new functions to anon by default: name the
-- roles explicitly (0007 precedent). Server (service_role) only.
revoke execute on function public.wall_post(text, text, text) from public, anon, authenticated;
revoke execute on function public.wall_list(text, integer) from public, anon, authenticated;
revoke execute on function public.wall_delete(text, uuid) from public, anon, authenticated;
grant execute on function public.wall_post(text, text, text) to service_role;
grant execute on function public.wall_list(text, integer) to service_role;
grant execute on function public.wall_delete(text, uuid) to service_role;
