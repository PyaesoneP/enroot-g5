-- Issue #16: saved outputs + public gallery (F-06, ADR-005).
--
-- 1. Retire charm_picks + delete_pick(). Nothing in the app ever wrote to
--    it (0 rows live, checked 2026-11-04), and its anon INSERT grant (0004)
--    was a public write path that skipped every server-side rate limit.
-- 2. outputs: one row per shared activity result. Stores the module's own
--    serialized form (`payload`) under the module id that made it
--    (`activity_id`), so swapping the active module never breaks old rows:
--    the gallery renders each row with the module named in it.
--
-- Same posture as 0007/0009/0011: no grants to anon/authenticated; the
-- Next server calls service-role-only definer functions after validating
-- the payload with the module and taking a rate-limit slot.
-- No personal data: no name or caption, only the bracelet (team decision
-- 2026-11-04), so rows may outlive the event (doc 05).

drop function if exists public.delete_pick(uuid, text);
drop table if exists public.charm_picks;

create table public.outputs (
  id          uuid        primary key default gen_random_uuid(),
  activity_id text        not null check (activity_id ~ '^[a-z0-9-]{1,40}$'),
  payload     text        not null check (char_length(payload) between 1 and 512),
  owner_hash  text        not null check (char_length(owner_hash) between 20 and 128),
  created_at  timestamptz not null default now(),
  -- Sharing the same bracelet twice (double tap, second visit) keeps one row.
  unique (owner_hash, activity_id, payload)
);

create index outputs_activity_created_idx on public.outputs (activity_id, created_at desc);
create index outputs_created_idx on public.outputs (created_at desc);

alter table public.outputs enable row level security;
revoke all on table public.outputs from public, anon, authenticated;
-- Ops only. Supabase's default privileges hand service_role everything on
-- a new table live (found on wall_posts, 0012), so revoke the writes
-- explicitly: rows only arrive through output_save()'s checks.
revoke insert, update, truncate, references, trigger on table public.outputs from service_role;
grant select, delete on table public.outputs to service_role;

-- Saves one output; returns its id, or the existing row's id when this
-- owner already shared the same payload. NULL = bad arguments.
create or replace function public.output_save(
  p_owner    text,
  p_activity text,
  p_payload  text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare out_id uuid;
begin
  if p_owner is null or char_length(p_owner) not between 20 and 128
     or p_activity is null or p_activity !~ '^[a-z0-9-]{1,40}$'
     or p_payload is null or char_length(p_payload) not between 1 and 512 then
    return null;
  end if;
  insert into public.outputs (owner_hash, activity_id, payload)
    values (p_owner, p_activity, p_payload)
    on conflict (owner_hash, activity_id, payload) do nothing
    returning outputs.id into out_id;
  if out_id is null then
    select o.id into out_id from public.outputs o
     where o.owner_hash = p_owner and o.activity_id = p_activity and o.payload = p_payload;
  end if;
  return out_id;
end $$;

-- Newest first, optionally one activity. `mine` instead of the owner hash.
create or replace function public.output_list(
  p_owner    text,
  p_activity text,
  p_limit    integer
)
returns table (id uuid, activity_id text, payload text, created_at timestamptz, mine boolean)
language sql
stable
security definer
set search_path = public
as $$
  select o.id, o.activity_id, o.payload, o.created_at,
         coalesce(p_owner is not null and o.owner_hash = p_owner, false)
    from public.outputs o
   where p_activity is null or o.activity_id = p_activity
   order by o.created_at desc, o.id
   limit greatest(1, least(coalesce(p_limit, 48), 200));
$$;

-- Removes an output only for its owner.
create or replace function public.output_delete(
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
  delete from public.outputs o where o.id = p_id and o.owner_hash = p_owner;
  get diagnostics n = row_count;
  return n > 0;
end $$;

-- Distinct activity ids that have outputs (the gallery shows a filter only
-- when there is more than one).
create or replace function public.output_activities()
returns setof text
language sql
stable
security definer
set search_path = public
as $$
  select distinct o.activity_id from public.outputs o order by 1;
$$;

revoke execute on function public.output_save(text, text, text) from public, anon, authenticated;
revoke execute on function public.output_list(text, text, integer) from public, anon, authenticated;
revoke execute on function public.output_delete(text, uuid) from public, anon, authenticated;
revoke execute on function public.output_activities() from public, anon, authenticated;
grant execute on function public.output_save(text, text, text) to service_role;
grant execute on function public.output_list(text, text, integer) to service_role;
grant execute on function public.output_delete(text, uuid) to service_role;
grant execute on function public.output_activities() to service_role;
