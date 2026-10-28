-- PR #36 second-round review fixes.
--
-- 1. picks limit was linkCount (18) by mistake. A bracelet holds at most
--    pickCount = 4 charms (content/charms.json), and src/activities/
--    charm-builder/picks.ts caps saves there. Bind to the real limit.
alter table public.charm_picks
  drop constraint charm_picks_picks_shape;
alter table public.charm_picks
  add constraint charm_picks_picks_shape check (
    case
      when jsonb_typeof(picks) = 'array'
      then jsonb_array_length(picks) between 1 and 4
           and octet_length(picks::text) <= 2048
      else false
    end
  );

-- 2. Exact capacity: the insert gate counted rows without locking
--    event_config, so two simultaneous RSVPs at 59/60 could both pass.
--    Locking the singleton row serialises RSVP inserts; at 60 guests the
--    contention is irrelevant, and capacity can no longer be overshot.
create or replace function public.rsvp_insert_allowed()
returns boolean
language plpgsql          -- not sql: FOR UPDATE inside a sql-function body
                          -- is a subquery and Postgres rejects it
volatile                  -- required: FOR UPDATE is banned in stable funcs;
                          -- re-evaluates per call, which the row lock needs
security definer
set search_path = public
as $$
declare
  cap bigint;
  open_ boolean;
begin
  select e.registration_open, e.capacity into open_, cap
  from public.event_config e
  where e.id = true
  for update;             -- serialises concurrent RSVP inserts
  if not coalesce(open_, false) then
    return false;
  end if;
  return (select count(*) from public.rsvps where deleted_at is null) < cap;
end;
$$;

-- 3. 0004's revokes covered only the four existing tables. Live
--    pg_default_acl showed the `postgres` role (which `db push` runs as
--    and which owns every public table) still hands anon/authenticated
--    arwdDxtm (all privileges incl. TRUNCATE) on every FUTURE table in
--    public. Revoke at the source so tables created by later migrations
--    (#14 wall, #16 gallery) start deny-by-default. Existing tables are
--    unaffected (0004 handled them). Functions/sequences are left alone —
--    Supabase internals depend on their default execute grants. Only
--    `postgres` is revoked: it is the migration-owner role, and altering
--    another role's default privileges (e.g. supabase_admin) needs
--    membership/superuser that the CLI role doesn't have.
alter default privileges for role postgres
  in schema public
  revoke all on tables from anon, authenticated, public;
