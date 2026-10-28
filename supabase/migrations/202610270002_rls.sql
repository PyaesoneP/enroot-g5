-- Row Level Security + explicit grants (issue #4 acceptance criteria).
-- Roles anon / authenticated / service_role are Supabase-managed.

grant usage on schema public to anon, authenticated, service_role;
grant select on public.event_config to anon, authenticated;
grant execute on function public.rsvp_live_count() to anon, authenticated;
-- Table privileges (RLS alone is not enough — issue #4 acceptance):
grant insert on public.rsvps to anon, authenticated;
grant select, insert on public.charm_picks to anon, authenticated;

-- ----------------------------------------------------------------------
-- rsvps: anonymous INSERT allowed only with consent; NO anon SELECT of
-- rows (count comes from the definer RPC); UPDATE/DELETE service-role
-- only (the ~19 Dec purge runs with the service role).
-- ----------------------------------------------------------------------
alter table public.rsvps enable row level security;

create policy "rsvp insert requires consent"
  on public.rsvps for insert
  to anon, authenticated
  with check (consent_given = true and deleted_at is null);

-- no select policy for anon: rows are invisible to the public API

create policy "rsvp purge service only"
  on public.rsvps for update
  to service_role
  using (true);

create policy "rsvp hard-delete service only"
  on public.rsvps for delete
  to service_role
  using (true);

-- ----------------------------------------------------------------------
-- charm_picks: public read (gallery), anon insert, ownership-scoped
-- delete. Identity model per ADR-008: session_id is a client-held
-- opaque token; spoofing it is accepted risk (controls are rate limits
-- + guardrails, ADR-009). Ids are non-guessable UUIDs, so a delete
-- scoped by session_id in the request is the ownership check.
-- ----------------------------------------------------------------------
alter table public.charm_picks enable row level security;

create policy "picks public read"
  on public.charm_picks for select
  to anon, authenticated
  using (true);

create policy "picks anon insert"
  on public.charm_picks for insert
  to anon, authenticated
  with check (true);

-- no anon delete policy: ownership check lives in delete_pick() below
-- (plain RLS cannot compare a row against a client-supplied token)

create or replace function public.delete_pick(pick_id uuid, caller_session text)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  n int;
begin
  delete from public.charm_picks
   where id = pick_id and session_id = caller_session;
  get diagnostics n = row_count;
  return n > 0;
end;
$$;

revoke all on function public.delete_pick(uuid, text) from public;
grant execute on function public.delete_pick(uuid, text) to anon, authenticated;

-- ----------------------------------------------------------------------
-- guest_tokens: service-role only. Explicitly revoke table access that
-- Supabase's default grants might hand out.
-- ----------------------------------------------------------------------
alter table public.guest_tokens enable row level security;
revoke all on public.guest_tokens from anon, authenticated;

create policy "tokens service only"
  on public.guest_tokens for all
  to service_role
  using (true);

-- ----------------------------------------------------------------------
-- event_config: public read, service-role writes.
-- ----------------------------------------------------------------------
alter table public.event_config enable row level security;

create policy "config public read"
  on public.event_config for select
  to anon, authenticated
  using (true);

create policy "config service writes"
  on public.event_config for all
  to service_role
  using (true);
