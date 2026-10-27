-- ENROOT G5 "Charm & Chatter" — initial schema (issue #4)
-- PDPA-minimal: nickname only, no email, soft-delete column for the
-- delete-personal-data-by-~19-Dec obligation from the submitted EPF.
-- Region: AWS ap-southeast-1 (Singapore) — forced by the EPF
-- no-overseas-transfer clause. See docs/05-supabase-schema.md.

create extension if not exists pgcrypto;

-- ----------------------------------------------------------------------
-- rsvps — event sign-ups. The ONLY table holding personal-ish data
-- (nickname + consent record). Delete-by-19-Dec targets this table.
-- ----------------------------------------------------------------------
create table public.rsvps (
  id            uuid primary key default gen_random_uuid(),
  nickname      text not null check (char_length(nickname) between 1 and 40),
  consent_given boolean not null,          -- policy forces true; see RLS
  consent_at    timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  deleted_at    timestamptz                -- soft-delete marker (PDPA)
);

-- ----------------------------------------------------------------------
-- charm_picks — saved bracelet builds. Anonymous by design (ADR-008):
-- session_id is an opaque client token, not personal data. Feeds the
-- optional gallery (#16) and event-day kiosk.
-- ----------------------------------------------------------------------
create table public.charm_picks (
  id         uuid primary key default gen_random_uuid(),
  session_id text not null check (char_length(session_id) between 8 and 64),
  picks      jsonb not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- guest_tokens — event-day check-in codes (issue #13). Never readable
-- by anon; service-role only (admin devices manage, kiosk redeems via
-- server-side code, not raw PostgREST).
-- ----------------------------------------------------------------------
create table public.guest_tokens (
  id         uuid primary key default gen_random_uuid(),
  code_hash  text not null unique,         -- store hash, not raw code
  max_uses   integer not null default 1 check (max_uses between 1 and 10),
  used_count integer not null default 0 check (used_count >= 0),
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------
-- event_config — singleton row driving runtime toggles.
-- ----------------------------------------------------------------------
create table public.event_config (
  id                 boolean primary key default true check (id),
  capacity           integer not null default 60 check (capacity between 1 and 500),
  live_count_visible boolean not null default true,
  registration_open  boolean not null default true,
  updated_at         timestamptz not null default now()
);

insert into public.event_config (id) values (true)
  on conflict do nothing;

-- Live counter must work without exposing nicknames: SECURITY DEFINER
-- RPC returns only the count. RLS on rsvps blocks all anon SELECT.
create function public.rsvp_live_count()
returns bigint
language sql
stable
security definer
set search_path = public
as $$
  select count(*) from public.rsvps where deleted_at is null;
$$;
