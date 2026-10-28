-- Hardening pass on rsvp_live_count(): explicit revoke-from-public +
-- narrow grants (anon, authenticated only). The earlier PGRST205 scare
-- was a false alarm — the smoke test POSTed to /rsvp_live_count instead
-- of /rpc/rsvp_live_count, so PostgREST looked for a TABLE. The RPC has
-- worked since 0002. This migration keeps the function identical but
-- locks down who can call it.

create or replace function public.rsvp_live_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*)::bigint
  from public.rsvps
  where deleted_at is null;
$$;

revoke execute on function public.rsvp_live_count() from public;
grant execute on function public.rsvp_live_count() to anon, authenticated;
