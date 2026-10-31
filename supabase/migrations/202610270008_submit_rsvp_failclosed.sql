-- PR #37 review round 2 (2026-10-31).
-- 1. submit_rsvp() failed OPEN when the event_config row was missing:
--    the SELECT left cap/open NULL, `if not open` skipped, and the
--    overshoot check compared against NULL — the insert returned 'ok'.
--    Fail closed now (0005 precedent).
-- 2. Richer answers: the function returns (status, spots_left) so the
--    route can tell 'all spots taken' from 'a group of 5 does not fit in
--    the 3 spots that are left'.
-- 3. Remove dead code: the 0004 anon insert policy and
--    rsvp_insert_allowed() guard a write path that 0007 revoked entirely
--    (and the policy never applied to service_role, which bypasses RLS —
--    it was never defence-in-depth for the definer insert). Consent is
--    guaranteed by the table CHECK from 0007, not the policy.

drop function public.submit_rsvp(text, integer, text, jsonb);

create or replace function public.submit_rsvp(
  p_nickname   text,
  p_group_size integer,
  p_vibe       text,
  p_picks      jsonb
)
returns table (status text, spots_left integer)
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
    return query select 'invalid', null::integer; return;
  end if;
  if p_group_size is null or p_group_size not between 1 and 5 then
    return query select 'invalid', null::integer; return;
  end if;
  if p_vibe is not null and p_vibe not in ('sweet', 'playful', 'dreamy', 'bold') then
    return query select 'invalid', null::integer; return;
  end if;
  if p_picks is not null and (
    jsonb_typeof(p_picks) <> 'array'
    or jsonb_array_length(p_picks) not between 1 and 4
    or pg_column_size(p_picks) > 2048
  ) then
    return query select 'invalid', null::integer; return;
  end if;

  -- Consent is not an input: the route only calls this after the checkbox
  -- was ticked, and the row is stored with consent_given = true, which the
  -- rsvp_consent_true CHECK enforces for every writer.
  select e.capacity, e.registration_open into cap, open
    from public.event_config e where e.id = true
    for update;  -- serialise concurrent submissions (0005 precedent)
  if open is null or cap is null then
    return query select 'closed', null::integer; return;  -- fail closed
  end if;
  if not open then
    return query select 'closed', null::integer; return;
  end if;

  select coalesce(sum(group_size), 0) into people
    from public.rsvps where deleted_at is null;
  if people >= cap then
    return query select 'full', 0; return;
  end if;
  if people + p_group_size > cap then
    return query select 'short', cap - people; return;
  end if;

  insert into public.rsvps (nickname, consent_given, group_size, vibe, picks)
    values (p_nickname, true, p_group_size, p_vibe, p_picks);
  return query select 'ok', cap - people - p_group_size;
end $$;

revoke all on function public.submit_rsvp(text, integer, text, jsonb)
  from anon, authenticated, public;
grant execute on function public.submit_rsvp(text, integer, text, jsonb) to service_role;

-- Dead code removal (see header 3).
drop policy "rsvp insert requires consent" on public.rsvps;
drop function public.rsvp_insert_allowed();
