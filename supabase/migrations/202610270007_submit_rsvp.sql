-- PR #37 review round 1 (2026-10-31): close the direct-insert bypass.
-- Findings 1-3:
--  1. 0006's table-wide `grant insert` let anon write EVERY column
--     (consent_at/created_at/id forgeable) — the narrow column grant was
--     decoration, since the table privilege already covers all columns.
--  2. anon INSERT meant any script could post straight to PostgREST and
--     skip /api/rsvp's rate limit, picks validation and vibe recompute.
--  3. Capacity and the live count counted ROWS, not group_size people.
--
-- Fix: revoke anon/authenticated INSERT entirely. Sign-ups go through
-- submit_rsvp(), a SECURITY DEFINER function executable ONLY by
-- service_role (called by the Next server via src/lib/db.ts). The service
-- role bypasses RLS, so the function re-checks consent, bounds, the vibe
-- whitelist, picks shape, and people-based capacity itself.

-- 1. No public writes to rsvps at all. Table-level revoke covers the
--    0006 column grants too; nothing is re-granted to anon/authenticated.
revoke all on public.rsvps from anon, authenticated, public;

-- Hard CHECK: a stored RSVP always carries consent. Defence in depth for
-- the service path (existing rows are all consent=true, validation is safe).
alter table public.rsvps
  add constraint rsvp_consent_true check (consent_given);

-- 2. Capacity + live count are PEOPLE (sum of group_size), not rows.
create or replace function public.rsvp_insert_allowed()
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  cap integer;
  open boolean;
  people integer;
begin
  select e.capacity, e.registration_open into cap, open
    from public.event_config e where e.id = true;
  if not open then
    return false;
  end if;
  select coalesce(sum(group_size), 0) into people
    from public.rsvps where deleted_at is null;
  return people < cap;
end $$;

create or replace function public.rsvp_live_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.live_count_visible
    then (select coalesce(sum(group_size), 0) from public.rsvps where deleted_at is null)
  end
  from public.event_config e
  where e.id = true;
$$;

-- 3. The only sign-up door. Returns 'ok', or a rejection code the server
--    maps to a user message. The 0004 insert policy stays as
--    defence-in-depth for service-role inserts.
create or replace function public.submit_rsvp(
  p_nickname   text,
  p_group_size integer,
  p_vibe       text,
  p_picks      jsonb
)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  cap integer;
  open boolean;
  people integer;
begin
  if p_nickname is null or char_length(p_nickname) not between 1 and 40 then
    return 'invalid';
  end if;
  if p_group_size is null or p_group_size not between 1 and 5 then
    return 'invalid';
  end if;
  if p_vibe is not null and p_vibe not in ('sweet', 'playful', 'dreamy', 'bold') then
    return 'invalid';
  end if;
  if p_picks is not null and (
    jsonb_typeof(p_picks) <> 'array'
    or jsonb_array_length(p_picks) not between 1 and 4
    or pg_column_size(p_picks) > 2048
  ) then
    return 'invalid';
  end if;

  -- Consent: the server route only calls this after the checkbox was
  -- checked, and the row is stored with consent_given = true unconditionally.
  select e.capacity, e.registration_open into cap, open
    from public.event_config e where e.id = true
    for update;  -- serialise concurrent submissions (0005 precedent)
  if not open then
    return 'closed';
  end if;
  select coalesce(sum(group_size), 0) into people
    from public.rsvps where deleted_at is null;
  if people + p_group_size > cap then
    return 'full';
  end if;

  insert into public.rsvps (nickname, consent_given, group_size, vibe, picks)
    values (p_nickname, true, p_group_size, p_vibe, p_picks);
  return 'ok';
end $$;

-- Supabase hands anon/authenticated EXECUTE on new functions by default;
-- revoke the roles explicitly (revoke-from-public alone left them the
-- grant on the live DB — caught by suite T3b).
revoke all on function public.submit_rsvp(text, integer, text, jsonb)
  from anon, authenticated, public;
grant execute on function public.submit_rsvp(text, integer, text, jsonb) to service_role;

-- 4. The Next server calls rsvp_live_count() with the service-role client
--    too (same DB client as submit_rsvp); grant it what it needs. Rows
--    SELECT the service role already has via the 0002 purge grants.
grant execute on function public.rsvp_live_count() to service_role;

-- 5. Codify service_role's rsvps privileges instead of relying on
--    Supabase-managed grants: the export, purge, and submit_rsvp's
--    definer insert need SELECT/UPDATE/DELETE/INSERT to survive a fresh
--    schema replay (found by the replay harness, which starts deny-by-
--    default unlike the live Supabase DB).
grant select, insert, update, delete on public.rsvps to service_role;

grant select on public.event_config to service_role;
