-- PR #36 review fixes (claims verified against live project where noted).
--
-- 1. DEFAULT-PRIVILEGE STRIP (live-confirmed: anon held SELECT/INSERT/
--    UPDATE/DELETE/TRUNCATE on rsvps + charm_picks from Supabase's
--    default-privileges behavior; RLS was the only real barrier).
--    Revoke everything, re-grant narrow, incl. COLUMN-level grants so
--    session_id is unreadable (live-confirmed leak: anon POST + GET
--    returned session_id) and clients cannot set id/created_at/
--    consent_at on inserts.
revoke all on public.rsvps        from anon, authenticated, public;
revoke all on public.charm_picks  from anon, authenticated, public;
revoke all on public.event_config from anon, authenticated, public;

grant select on public.event_config to anon, authenticated;
-- rsvps: insert only, only these columns; everything else defaults
grant insert (nickname, consent_given) on public.rsvps to anon, authenticated;
-- charm_picks: read WITHOUT session_id; insert without id/created_at
grant select (id, picks, created_at) on public.charm_picks to anon, authenticated;
grant insert (session_id, picks) on public.charm_picks to anon, authenticated;

-- 2. GATE: registration_open + capacity enforced in the DB (was
--    consent-only; direct API posts could RSVP when closed/full).
--    Count subquery must see rows -> definer fn (anon has no SELECT).
create or replace function public.rsvp_insert_allowed()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select e.registration_open
     and (select count(*) from public.rsvps where deleted_at is null) < e.capacity
  from public.event_config e
  where e.id = true;
$$;
revoke all on function public.rsvp_insert_allowed() from public;
grant execute on function public.rsvp_insert_allowed() to anon, authenticated;

drop policy "rsvp insert requires consent" on public.rsvps;
create policy "rsvp insert requires consent"
  on public.rsvps for insert
  to anon, authenticated
  with check (
    consent_given = true
    and deleted_at is null
    and public.rsvp_insert_allowed()
  );

-- 3. rsvp_live_count() respects live_count_visible (returns NULL when
--    off, so clients can render nothing instead of a number).
create or replace function public.rsvp_live_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select case
    when e.live_count_visible
    then (select count(*) from public.rsvps where deleted_at is null)
  end
  from public.event_config e
  where e.id = true;
$$;

-- 4. charm_picks.picks shape/size bound (gallery junk + storage-fill):
--    jsonb array of 1..18 items (max links per bracelet), <= 2048 bytes.
alter table public.charm_picks
  add constraint charm_picks_picks_shape check (
    case
      when jsonb_typeof(picks) = 'array'
      then jsonb_array_length(picks) between 1 and 18
           and octet_length(picks::text) <= 2048
      else false
    end
  );

-- 5. guest_tokens: atomic cap on redemptions (two kiosks redeeming the
--    same code concurrently can no longer both exceed max_uses; the
--    second UPDATE now fails the constraint instead of racing).
alter table public.guest_tokens
  drop constraint if exists guest_tokens_used_count_check;
alter table public.guest_tokens
  add constraint guest_tokens_uses_check check (used_count between 0 and max_uses);

-- 6. Remove service_role policies: dead code. Supabase's service_role
--    has BYPASSRLS; these never evaluated and implied protection that
--    comes from the table-level revokes above, not from RLS.
drop policy if exists "rsvp purge service only"     on public.rsvps;
drop policy if exists "rsvp hard-delete service only" on public.rsvps;
drop policy if exists "tokens service only"         on public.guest_tokens;
drop policy if exists "config service writes"       on public.event_config;
