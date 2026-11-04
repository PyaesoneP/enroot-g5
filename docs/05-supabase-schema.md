# Doc 05 — Supabase schema (issue #4)

> Status: LIVE on project `ljrlsyajjcedegqqpfbk` (Charms_and_Chatters,
> ap-southeast-1 — Singapore, forced by the EPF no-overseas-transfer clause).
> Migrations `202610270001`–`0005` applied via `supabase db push`;
> acceptance suite (T1-T10 + T8c) green on the live project and on a fresh
> Postgres 16 replay of all five migrations.

## Tables

| Table | Holds | Personal data? | Who touches it |
|---|---|---|---|
| `rsvps` | nickname, group size, vibe, bracelet picks, consent record | **yes** (nickname + consent timestamp) | **no public writes at all** — sign-ups go through `submit_rsvp()` (service_role only, 0007); service-role reads/purges |
| `outputs` | gallery entries: `activity_id` + the module's serialized payload (≤ 512) + owner hash (0013, #16; replaces `charm_picks`) | no (no name or caption, team decision 2026-11-04) | **no grants** to anon/authenticated; only via `output_save()` / `output_list()` / `output_delete()` / `output_activities()`, service_role only |
| `guest_tokens` | event-day check-in codes, **hashed** | no | service-role only; anon/authenticated fully revoked |
| `event_config` | singleton: capacity, live-count toggle, registration toggle | no | anon read; service-role write |
| `wall_posts` | friendship wall: optional name (≤ 40), message (≤ 280), owner hash (0011, #14) | **yes** (optional name + free text, public) | **no grants** to anon/authenticated; only via `wall_post()` / `wall_list()` / `wall_delete()`, service_role only; service_role SELECT/DELETE for ops (0012 revokes the INSERT/UPDATE/TRUNCATE Supabase's defaults had granted) |
| `rate_limits` | rate-limit counters (sign-up, wall, gallery): opaque key, fixed window start, hit count (0009, #11) | no: keys are HMACs, never a raw IP or guest id; rows older than a day are purged daily | **no grants** to anon/authenticated; only via `rate_limit_hit()` / `rate_limit_release()`, service_role only |

## PDPA posture (EPF Section E ticked **No**, confirmed 2026-10-27)

- No prescribed consent-clause mirroring required; the site still shows a
  plain consent checkbox and records `consent_given` + `consent_at` — cheap
  insurance, not compliance theater.
- **Nickname only. No email, no IP, no device fingerprint in the DB.**
- Delete-by-~19-Dec obligation targets `rsvps` and, since 0011,
  `wall_posts` (public posts with an optional name; the post form says the
  wall is cleared by 19 Dec — team decision 2026-11-04). Wall rows are
  hard-deleted (`delete from public.wall_posts;`), no soft delete.
  For `rsvps`:
  `deleted_at` soft-delete + a purge script (`SET deleted_at = now()`),
  hard DELETE at 30 days. `outputs` carries no personal data, so the
  gallery (#16) can outlive the event.
- `guest_tokens` stores a hash, never the raw code — a DB leak cannot
  mint valid check-ins.

## Access model (post PR #36 review, migration 0004)

- `anon` key is the only client credential. No participant accounts.
- **Deny-by-default privileges.** Supabase's default-privileges behavior
  hands `anon`/`authenticated` every table grant on new tables; 0002
  never revoked that (found in review — live check confirmed anon held
  SELECT/UPDATE/DELETE/TRUNCATE on `rsvps`). 0004 revokes all and grants
  back narrowly, **down to column level**:
  - `rsvps`: **no grants to anon/authenticated at all** (0007 revoked the
    0006 insert; SELECT was already denied at the table level). The only
    sign-up door is `submit_rsvp(p_nickname, p_group_size, p_vibe,
    p_picks)` — SECURITY DEFINER, EXECUTE granted to `service_role`
    only (Supabase hands anon EXECUTE on new functions by default, so
    the revoke names the roles explicitly). The function validates
    bounds, the vibe whitelist, picks shape, and people-based capacity
    (`sum(group_size)` fits the cap, `event_config` locked `for
    update`), returns `(status, spots_left)` (0008), and stores
    `consent_given = true` unconditionally; a table CHECK enforces
    consent on every stored row. The Next server
    calls it with the service-role key from `src/lib/db.ts` — clients
    cannot post straight to PostgREST to skip `/api/rsvp`'s rate limit
    or validation.
  - `charm_picks`: `select (id, picks, created_at)`, `insert
    (session_id, picks)` → `session_id` is unreadable through the API,
    which is what made `delete_pick()` gameable before (read a row,
    steal its token, delete the pick).
- Registration gate is enforced **in the database**: `submit_rsvp()`
  checks `registration_open` and `sum(group_size) + incoming <= capacity`
  under a `FOR UPDATE` lock on the singleton, returning
  `closed`/`full`/`short (spots_left)` instead of storing (0007 counts
  **people**, not rows; 0008 fails closed if the config row is missing
  and drops the old anon insert policy + `rsvp_insert_allowed()`, which
  guarded a write path 0007 had revoked — service_role bypasses RLS, so
  the policy never applied to the definer insert). Consent is enforced
  by the `rsvp_consent_true` CHECK, not a policy.
- `rsvp_live_count()` counts people (`sum(group_size)`), returns NULL
  when `live_count_visible` is off; returns only the number, never rows.
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

`supabase/tests/rls_acceptance.sql` runs as role `anon`, and
`supabase/tests/submit_rsvp_acceptance.sql` runs as `service_role` (the
only role that can execute the door). Both are delta-based (re-runnable
on a live table with real RSVPs), normalise both toggles to a known
state at start (round-2 review: `NULL <> x` is unknown, so a hidden
count could make a wrongly-accepted insert print PASS), and assert:

| Test | Assertion | Result |
|---|---|---|
| T1 | any anon INSERT into `rsvps` rejected at the privilege level | PASS |
| T2 | forged-column insert (`id`/`created_at`/`consent_at`) rejected | PASS |
| T3 | anon SELECT on rsvps = hard table-level denial (no empty-result loophole) | PASS |
| T3b | anon cannot EXECUTE `submit_rsvp` | PASS |
| T4 | `rsvp_live_count()` grows +5 people after group_size 2+3 inserts, with no row access | PASS |
| T6 | anon denied `guest_tokens` entirely | PASS |
| T7 | `delete_pick`: wrong session + random UUID rejected; owner session accepted | PASS |
| T8 | anon cannot read `charm_picks.session_id` (column grant) | PASS |
| T8b | non-array and >2 KB picks rejected (CHECK) | PASS |
| T8c | 5 picks rejected — cap is 4 = pickCount (0005) | PASS |
| T10 | `rsvp_live_count()` returns NULL while `live_count_visible = false` | PASS |
| S1 | valid submits accepted; count counts people (+3) | PASS |
| S2 | null/empty/41-char nickname, group 0/6, unknown vibe, bad picks shapes → `invalid`, nothing stored | PASS |
| S3 | stored rows carry `consent_given` | PASS |
| S4 | capacity is people-based: overshooting group returns `short` (headcount unchanged), exact fill returns `full`, `spots_left` accurate | PASS |
| S5 | closed registration → `closed`, nothing stored | PASS |
| S6 | hidden count → NULL even for service_role | PASS |
| S7 | missing event_config row → `closed` (fail-closed, 0008) | PASS |
| post | anon suite asserts a net-zero table after every test | PASS |
| R1 | `rate_limit_hit`: 10 hits allowed, 11th denied with `retry_after > 0` | PASS |
| R2 | release frees a slot; R2b: release floors at zero | PASS |
| R3 | keys are independent | PASS |
| R4 | anon cannot execute either limiter function or read `rate_limits` | PASS |
| R5 | a new window resets the count | PASS |
| R6 | bad arguments (window 0) raise instead of counting | PASS |
| R7 | a hit on any key clears every window older than a day (0010) | PASS |
| R8 | `rate_limit_purge()` drops stale windows without traffic and keeps current ones | PASS |
| R9 | `rate_limit_clear()` resets a key that was pushed past its max | PASS |
| R4b | anon cannot execute `rate_limit_purge` / `rate_limit_clear` | PASS |
| orch | `scripts/rate-limit-check.mjs`: reserve/release/fail-open orchestration with a fake store (8 cases, incl. separate counters per action) | PASS |
| W1 | anon/authenticated hold no privilege on `wall_posts` (asserted with `has_table_privilege`) and cannot execute the functions; service_role has SELECT/DELETE but not INSERT/UPDATE/TRUNCATE (0012) | PASS (local replay) |
| W2 | named, unnamed, 40-char name + 280-char body stored | PASS (local replay) |
| W3 | empty / blank / 281-char body, 41-char / blank name, bad owner → `invalid`, nothing stored | PASS (local replay) |
| W4 | `mine` true only for the caller's posts; `owner_hash` not returned | PASS (local replay) |
| W5 | stranger / null owner / unknown id cannot delete; owner can | PASS (local replay) |
| W6 | `wall_open = false` → `closed`, nothing stored | PASS (local replay) |
| W7 | missing config row → `closed` (fails closed) | PASS (local replay) |
| W8 | list limit clamped (0 → 1 row) | PASS (local replay) |
| R-par | 20 concurrent hits on one key with max 10 → exactly 10 allowed (upsert is atomic) | PASS (local replay) |

REST-level smoke (anon key, live project): `rsvps` read → 401, `rsvps`
insert → 42501, `/rpc/submit_rsvp` → 401, `charm_picks.session_id` read
→ 401, `/rpc/rsvp_live_count` → 200. Future-table posture probe (live):
create temp table as `postgres` → anon privileges `NONE`.

Replay locally: `docker run -e POSTGRES_PASSWORD=test -p 5544:5432 -d
postgres:17-alpine`, create roles `anon`/`authenticated`/`service_role`
(`service_role` with `bypassrls`), then **seed Supabase's default grants**
before migrating, so the replay starts from what a live project hands new
tables:

```sql
alter default privileges for role postgres in schema public
  grant all on tables to anon, authenticated, service_role;
```

Apply all migration files and run the five test files (`rls_acceptance`,
`submit_rsvp_acceptance`, `rate_limit_acceptance`, `wall_acceptance`,
`outputs_acceptance`). With the seed, a missing revoke (0004/0005 for
anon, 0012/0013 for service_role writes) fails W1/O1 locally instead of
passing trivially. Before 2026-11-04 the replay was deny-by-default, which
caught the un-codified `service_role` grants (now in 0007) but hid the
live default grants that 0012 revokes.

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

## Rate limiting (0009, issue #11)

Each public write route calls `rate_limit_hit(key, window_sec, max)` once
per limit: sign-up per IP (10 / minute) and per guest cookie (5 / hour,
#13); wall posts per IP (20 / minute) and per guest (5 / 10 minutes, #14);
gallery shares per IP (20 / minute) and per guest (10 / hour, #16).
Each action counts separately (limits in `src/lib/rate-limit-keys.ts`). It is a
fixed-window counter: an atomic upsert on `(key, window_start)`, so every
serverless instance shares one count (the old in-memory map counted per
instance). Hits over the cap still count, so a flood stays blocked for its
window. `rate_limit_release()` gives a hit back when a sign-up is not
stored, so mistakes and closed/full answers stay free. Keys are
`<action>:ip:`/`<action>:guest:` + HMAC-SHA256 (keyed with the service-role key) of the
value, so no raw IP reaches the store. Rows older than a day are
removed by every `rate_limit_hit()` call, for any key (0010; 0009 only cleaned
the caller's own key). They're also removed by `rate_limit_purge()`, which a
daily Vercel cron calls through `/api/cron/purge-rate-limits` (03:00 SGT). The
cron is what keeps retention true once traffic stops after the event.
`rate_limit_clear(key)` drops one key entirely; it's for ops and the e2e test,
because releases alone can't zero a counter that denied hits pushed past its
max. If the limiter is unreachable the route **fails open**
(logged); `submit_rsvp()`'s capacity gate stays the hard limit.

## Friendship wall (0011, issue #14)

`wall_posts` holds `owner_hash` (HMAC of the poster's `g5_guest` cookie,
labelled `owner:` so it never equals a limit key), an optional `name`
(1..40), `body` (1..280, CHECKed) and `created_at`. No grants to
anon/authenticated. `/api/wall` validates, runs the stop-word filter
(`content/stopwords.txt`), takes a per-IP + per-guest slot, then calls:

- `wall_post(owner, name, body)` → `(status, id)`: `ok`, `invalid` (bounds,
  re-checked here), or `closed` when `event_config.wall_open` is off or the
  config row is missing (fails closed).
- `wall_list(owner, limit)` → newest first, `(id, name, body, created_at,
  mine)`; the owner hash never leaves the database; limit clamped 1..200.
- `wall_delete(owner, id)` → true only for the owner's own post.

`event_config.wall_open` (default true) is the organiser's kill switch for
posting, flipped in the Table Editor. Moderation: delete the row in the
Table Editor (ADR-009 human fallback). Suite: `supabase/tests/wall_acceptance.sql`.

## Gallery (0013, issue #16)

0013 drops `charm_picks` and `delete_pick()`: nothing ever wrote to the
table (0 rows live, 2026-11-04) and its anon INSERT grant was a public write
path with no rate limit. (Their tests T7/T8/T8b/T8c left the RLS suite.)

`outputs` stores `activity_id` (`^[a-z0-9-]{1,40}$`), `payload` (the
module's `serialize()` form, 1..512 chars), `owner_hash` and `created_at`,
unique per (owner, activity, payload) so sharing twice keeps one row.
`/api/outputs` always uses the live module, parses the payload with it,
requires a finished output (`shareable`), stores the re-serialized form and
takes a per-IP (20 / minute) + per-guest (10 / hour) slot. The gallery
renders each row with the module named in its `activity_id`, so a module
swap leaves old rows readable; rows with an unknown module or a payload that
no longer parses are skipped.

| Test | Assertion | Result |
|---|---|---|
| O1 | anon/authenticated hold no privilege on `outputs` and cannot execute the functions; service_role has SELECT/DELETE but not INSERT/UPDATE/TRUNCATE; `charm_picks` is gone | PASS (local replay) |
| O2 | save returns an id; same owner + payload returns the same id; another owner gets its own | PASS (local replay) |
| O3 | bad owner / activity id / empty or 513-char payload → NULL, nothing stored | PASS (local replay) |
| O4 | a `retired-module` row still lists; the activity filter works | PASS (local replay) |
| O5 | `mine` only for the owner; `owner_hash` not returned | PASS (local replay) |
| O6 | stranger / null / unknown id cannot delete; owner can | PASS (local replay) |
| O7 | list limit clamped | PASS (local replay) |

## Open items

- Vercel env vars landed with the #15 deploy: `NEXT_PUBLIC_SUPABASE_URL`
  + anon key (client/reads), `SUPABASE_SERVICE_ROLE_KEY` server-side only
  (submit_rsvp, export).
- #13 redeem path should `UPDATE ... SET used_count = used_count + 1`
  inside one transaction; the DB CHECK backstops the race now.
