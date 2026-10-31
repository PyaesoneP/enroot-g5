-- Issue #15 (rescoped 2026-10-31): sign-up rides the charm builder.
-- rsvps gains group_size, vibe, and the bracelet picks that produced the
-- vibe. Vibe is computed server-side from the picks (never trusted from
-- the client); picks stored for charm-stock planning and the gallery (#16).
-- Deny-by-default posture kept: revoke, then re-grant the widened column
-- set (0004's grant replaced; unlisted columns stay uninsertable).

alter table public.rsvps
  add column group_size integer not null default 1
    check (group_size between 1 and 5),
  add column vibe text
    check (vibe in ('sweet', 'playful', 'dreamy', 'bold')),
  add column picks jsonb
    check (
      picks is null
      or (
        jsonb_typeof(picks) = 'array'
        and jsonb_array_length(picks) between 1 and 4
        and pg_column_size(picks) <= 2048
      )
    );

revoke all on public.rsvps from anon, authenticated, public;
-- PostgREST gates writes on the TABLE-level privilege first (psql honours
-- column-only grants, PostgREST does not — found live 2026-10-31), so the
-- table INSERT is granted, and the COLUMN grants keep the insertable set
-- narrow: columns outside this list are still rejected.
grant insert on public.rsvps to anon, authenticated;
grant insert (nickname, consent_given, group_size, vibe, picks)
  on public.rsvps to anon, authenticated;

-- Insert policy unchanged (consent + rsvp_insert_allowed()); re-create so
-- the migration is self-documenting about what still guards these columns.
