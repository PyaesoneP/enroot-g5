# Doc 05 — Supabase schema (issue #4)

> Status: implemented in `supabase/migrations/`, verified against Postgres 16
> (see "Verification"). Pending: project provisioning at AWS ap-southeast-1
> (Singapore) — forced by the EPF no-overseas-transfer clause.

## Tables

| Table | Holds | Personal data? | Who touches it |
|---|---|---|---|
| `rsvps` | nickname, consent record | **yes** (nickname + consent timestamp) | anon INSERT only; service-role reads/purges |
| `charm_picks` | saved bracelet builds (jsonb) under an opaque `session_id` | no (ADR-008 anonymous identity) | anon read+insert; owner-scoped delete via `delete_pick()` |
| `guest_tokens` | event-day check-in codes, **hashed** | no | service-role only; anon has zero access |
| `event_config` | singleton: capacity, live-count toggle, registration toggle | no | anon read; service-role write |

## PDPA posture (EPF Section E ticked **No**, confirmed 2026-10-27)

- No prescribed consent-clause mirroring required; the site still shows a
  plain consent checkbox and records `consent_given` + `consent_at` — cheap
  insurance, not compliance theater.
- **Nickname only. No email, no IP, no device fingerprint in the DB.**
- Delete-by-~19-Dec obligation targets exactly one table (`rsvps`);
  `deleted_at` soft-delete + a purge script (`SET deleted_at = now()`),
  hard DELETE at 30 days. `charm_picks` carries no personal data, so it
  can outlive the event for the gallery (#16).
- `guest_tokens` stores a hash, never the raw code — a DB leak cannot
  mint valid check-ins.

## Access model

- `anon` key is the only client credential. No participant accounts.
- Live counter = `rsvp_live_count()` (`security definer`, returns a number
  only). Anon **cannot SELECT rsvps rows at all** — table-level grant omits
  select, so the count never leaks nicknames.
- RLS *and* explicit grants (issue #4 acceptance): Supabase's default
  grants do not cover this posture; the migration grants insert/select
  per table and revokes everything on `guest_tokens`.
- Ownership for pick deletion cannot be expressed in plain RLS (a policy
  cannot compare the row against a client-supplied token), so it lives in
  `delete_pick(pick_id, caller_session)` — definer function, revoked from
  public, granted to anon/authenticated.

## Verification (2026-10-27, Postgres 16)

Migrations apply cleanly (`ON_ERROR_STOP`). `supabase/tests/rls_acceptance.sql`
runs as role `anon` and asserts:

| Test | Assertion | Result |
|---|---|---|
| T1 | RSVP insert **without** consent rejected (42501) | PASS |
| T2 | RSVP insert with consent accepted | PASS |
| T3 | anon cannot SELECT rsvp rows (hard table-level denial) | PASS |
| T4 | `rsvp_live_count()` grows by exactly +2 after two consented inserts, with no row access | PASS |
| T5 | 41-char nickname rejected (CHECK) | PASS |
| T6 | anon denied `guest_tokens` entirely | PASS |
| T7 | `delete_pick`: wrong session + random UUID rejected; owner session accepted | PASS |

Replay locally: `docker run -e POSTGRES_PASSWORD=test -p 5544:5432 -d
postgres:16-alpine`, create roles `anon`/`authenticated`/`service_role`
(`service_role` with `bypassrls`), apply both migrations, run the test file.

## Deliberate deviations from issue #4's draft sketch

- Issue text says "wall" and "outputs" tables — the activity changed
  (Charm & Chatter, 2026-10-09 plan change); `charm_picks` covers the
  gallery/kiosk need, the wall (#14) is stretch and will add its own
  migration if built.
- "Anon insert/read on all tables" contradicts PDPA-minimal: rsvp rows are
  write-only from the public API on purpose.
- Anonymous auth (Supabase `signinAnon`) is **not needed for these
  tables** — the anon key alone is the identity model we already use in
  the DAL design (#6). Enable Supabase auth-anon only if the wall (#14)
  needs a real per-user JWT; until then one fewer moving part.

## Open until provisioning

- Project creation on Pyae's Supabase free org, region **ap-southeast-1**.
- Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, anon key; service-role key
  server-side only) land with #23.
