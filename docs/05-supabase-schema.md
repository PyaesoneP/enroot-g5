# Doc 05 — Supabase schema (issue #4)

> Status: LIVE on project `ljrlsyajjcedegqqpfbk` (Charms_and_Chatters,
> ap-southeast-1 — Singapore, forced by the EPF no-overseas-transfer clause).
> Migrations `202610270001`–`0005` applied via `supabase db push`;
> acceptance suite (T1-T10 + T8c) green on the live project and on a fresh
> Postgres 16 replay of all five migrations.

## Tables

| Table | Holds | Personal data? | Who touches it |
|---|---|---|---|
| `rsvps` | nickname, consent record | **yes** (nickname + consent timestamp) | anon INSERT (columns `nickname`,`consent_given` only; gated, see below); service-role reads/purges |
| `charm_picks` | saved bracelet builds (jsonb, shape-bound) under an opaque `session_id` | no (ADR-008 anonymous identity) | anon read (`id`,`picks`,`created_at` — **not** `session_id`) + insert; owner-scoped delete via `delete_pick()` |
| `guest_tokens` | event-day check-in codes, **hashed** | no | service-role only; anon/authenticated fully revoked |
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

## Access model (post PR #36 review, migration 0004)

- `anon` key is the only client credential. No participant accounts.
- **Deny-by-default privileges.** Supabase's default-privileges behavior
  hands `anon`/`authenticated` every table grant on new tables; 0002
  never revoked that (found in review — live check confirmed anon held
  SELECT/UPDATE/DELETE/TRUNCATE on `rsvps`). 0004 revokes all and grants
  back narrowly, **down to column level**:
  - `rsvps`: `insert (nickname, consent_given)` only → clients cannot
    forge `id`/`created_at`/`consent_at` (backdating blocked). SELECT
    denied at the **table level** (not just RLS filtering).
  - `charm_picks`: `select (id, picks, created_at)`, `insert
    (session_id, picks)` → `session_id` is unreadable through the API,
    which is what made `delete_pick()` gameable before (read a row,
    steal its token, delete the pick).
- Registration gate is enforced **in the database**: the RSVP insert
  policy requires `public.rsvp_insert_allowed()` (definer fn checking
  `registration_open` and `count < capacity`), so direct API posts
  cannot RSVP when closed or full. The fn locks the `event_config`
  singleton row `for update`, serialising concurrent inserts — capacity
  cannot be overshot by a race (0005).
- `rsvp_live_count()` returns NULL when `live_count_visible` is off;
  returns only the number, never rows, when on.
- `charm_picks.picks` CHECK: jsonb array, 1..**4** items (= `pickCount`
  in `content/charms.json`; a bracelet physically holds 4 — 0005
  tightened the original 18, which was `linkCount` by mistake),
  ≤ 2048 bytes (gallery junk / free-tier storage fill bounded).
- `guest_tokens` CHECK `used_count between 0 and max_uses` → concurrent
  redemptions of the same code can't both slip past the cap at the DB
  layer (the redeem path in #13 still wraps in a transaction).
- Ownership for pick deletion lives in `delete_pick(pick_id,
  caller_session)` — definer function, revoked from public, granted to
  anon/authenticated. Spoofing a *known* session token remains accepted
  risk (ADR-008); what 0004 removes is the ability to *harvest* every
  token from the table.
- No `service_role` RLS policies: service_role has BYPASSRLS, so such
  policies are dead code (removed in 0004). Protection for
  `guest_tokens` comes from the table-level revokes.
- **Future tables are deny-by-default too** (0005): `alter default
  privileges for role postgres in schema public revoke all on tables
  from anon, authenticated, public`. Verified live — a table created
  after 0005 shows zero anon/authenticated privileges. Caveat:
  `supabase_admin`'s own default privileges still grant anon everything,
  but the CLI role can't alter another role's defaults (42501); all app
  tables are created by `postgres` via `db push`, so the gap only
  matters if Supabase itself creates public tables owned by
  supabase_admin — re-check with the privilege query below if that ever
  shows up.

## Verification (live + local, 2026-10-29)

`supabase/tests/rls_acceptance.sql` runs as role `anon`, is delta-based
(re-runnable on a live table with real RSVPs), normalizes both toggles
to a known state at start (round-2 review: `NULL <> x` is unknown, so a
hidden count could make T9/post-state print PASS on a wrongly-accepted
insert), and asserts:

| Test | Assertion | Result |
|---|---|---|
| T1 | RSVP insert **without** consent rejected | PASS |
| T2 | RSVP insert with consent accepted | PASS |
| T3 | anon SELECT on rsvps = hard table-level denial (no empty-result loophole) | PASS |
| T4 | `rsvp_live_count()` grows +2 after two consented inserts, with no row access | PASS |
| T5 | 41-char nickname rejected (CHECK) | PASS |
| T6 | anon denied `guest_tokens` entirely | PASS |
| T7 | `delete_pick`: wrong session + random UUID rejected; owner session accepted | PASS |
| T8 | anon cannot read `charm_picks.session_id` (column grant) | PASS |
| T8b | non-array and >2 KB picks rejected (CHECK) | PASS |
| T8c | 5 picks rejected — cap is 4 = pickCount (0005) | PASS |
| T9 | RSVP insert rejected while `registration_open = false` | PASS |
| T10 | `rsvp_live_count()` returns NULL while `live_count_visible = false` | PASS |
| post | net +4 rsvp rows vs. baseline sampled at run start | PASS |

REST-level smoke (anon key, live project): `rsvps` read → 401,
`charm_picks.session_id` read → 401, insert overriding `created_at` →
401, `/rpc/rsvp_live_count` → 200. Future-table posture probe (live):
create temp table as `postgres` → anon privileges `NONE`.

Replay locally: `docker run -e POSTGRES_PASSWORD=test -p 5544:5432 -d
postgres:16-alpine`, create roles `anon`/`authenticated`/`service_role`
(`service_role` with `bypassrls`), apply all five migration files, run
the test file.

## Deliberate deviations from issue #4's draft sketch

- Issue text says "wall" and "outputs" tables — the activity changed
  (Charm & Chatter, 2026-10-09 plan change); `charm_picks` covers the
  gallery/kiosk need, the wall (#14) is stretch and will add its own
  migration if built.
- "Anon insert/read on all tables" contradicts PDPA-minimal: rsvp rows
  are write-only from the public API on purpose.
- Anonymous auth (Supabase `signinAnon`) is **not needed for these
  tables** — the anon key alone is the identity model we already use in
  the DAL design (#6). Enable Supabase auth-anon only if the wall (#14)
  needs a real per-user JWT; until then one fewer moving part.

## Open items

- **#6 DAL implications**: on `charm_picks`, `.select('id')` after an
  insert still works (`id` is select-granted), but any query touching
  `session_id` — `.eq('session_id', ...)`, `.select('session_id')` —
  is now a permission error. The client stores its session token
  locally (localStorage) and keeps pick ids from insert responses; it
  never queries by session. Nothing in src/ touches the DB yet.

- Vercel env vars (`NEXT_PUBLIC_SUPABASE_URL`, anon key; service-role key
  server-side only) land with #23.
- #13 redeem path should `UPDATE ... SET used_count = used_count + 1`
  inside one transaction; the DB CHECK backstops the race now.
