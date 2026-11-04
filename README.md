# EnROOT Group 5 - Event Site

Event site for **EnROOT Group 5** (15th ROOT, SUTD), part of the 15th ROOT
EnROOT trial cohort.

**Live site:** https://enroot-g5.vercel.app/

## The event

- **Theme:** Friendship
- **Date:** Thursday, 19 November 2026
- **Venue:** Root Cove, SUTD
- **Event:** Charm & Chatter, 7:00pm to 9:00pm. Italian charm friendship
  bracelets, made in pairs: each person builds an 18-link bracelet and picks
  4 charms (EPF draft 2026-10-20; replaces stress ball making, see
  `docs/00-software-requirements.md` section 9). The site's interactive is
  a pluggable module (ADR-005); v1 = "Make your bracelet" (pick 4 charms, see them on a rendered bracelet)

Full program context (trial cohort, ROOTech requirements, Phase 2 briefing) is
in the team's notes; the ROOTech-relevant part is in
[docs/README.md](./docs/README.md).

## Documentation (architecture)

The architecture of the target system (event site + companion Telegram bot over
a shared store) is documented in [`docs/`](./docs/README.md):

1. [Architectural Characteristics](./docs/01-architectural-characteristics.md) - the 4 qualities the system must satisfy
2. [Architectural Decisions](./docs/02-architectural-decisions.md) - ADR log (10 ADRs)
3. [Logical Components](./docs/03-logical-components.md) - component decomposition + deployment view (Mermaid)
4. [Architectural Style](./docs/04-architectural-style.md) - style taxonomy (layered, serverless, BaaS, blackboard, strategy)

This is part of the ROOTech evaluation: the team is graded on **product and
process**.

## Status

The live page is currently a **holding page**: theme (Friendship), date
(Thu 19 Nov 2026), venue (Root Cove) and a timeline. The theme was drawn 6 Oct;
the real event site is the next build: landing + Charm & Chatter activity page +
"Make your bracelet" builder + RSVP for the first milestone, then the
friendship wall, gallery and Telegram bot as optional extras, per the ADRs
above.

## Requirements (from the ROOTech brief)

- **Front-end:** Next.js + Tailwind
- **Responsive:** mobile-first layout, verified at phone / tablet / desktop widths
- **GitHub repo:** this repo
- **Backend:** not required for the shell; the target design uses Supabase
 (see ADR-004) for the wall / RSVP / saved outputs
- **AI usage:** allowed, but the brief asks for customization and "life of its
 own". No generic machine-generated output. The content is hand-written for
 this specific team and event.

## Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4
- Supabase (Postgres + RLS + anonymous Auth) behind a typed data layer
- Deployed on Vercel (static site + serverless route handlers)
- Telegram bot (TypeScript route handlers), shared store, Vercel webhook + cron (ADR-010)

## Process

1. Scaffolded the app (Next.js + TS + Tailwind + ESLint).
2. Replaced the boilerplate with a clean, responsive shell: header, timeline,
  placeholder hero. Dark-mode aware.
3. Committed to GitHub, deployed to Vercel for a live URL.
4. **Theme drawn 6 Oct (Friendship); event = 19 Nov, Root Cove** (moved from
   20 Nov / Campus Center on 6 Oct). Documented
  the target architecture in `docs/` (4 docs + ADR log).
5. **Activity changed 20 Oct:** stress ball making replaced by Charm & Chatter
   (Italian charm bracelets) in the EPF draft. Copy, SRS and issues re-scoped;
   no code had to change (ADR-005).
6. **Next:** build the real event site (landing, activity page, quiz, RSVP),
  stand up Supabase, deploy. Stretch: wall, gallery, and the Telegram
  bot (live count, charm of the day, event-day nudges; ADR-010).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Environment variables

Create `.env.local` (gitignored) in the project root with:

| Variable | Used by | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | client + server | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | client reads + `rsvp_live_count()` | anon key, RLS-restricted |
| `SUPABASE_SERVICE_ROLE_KEY` | server only (`/api/rsvp` via `src/lib/db.ts`, export script) | NEVER a `NEXT_PUBLIC_` variable; sign-ups fail without it |

On Vercel the same three are set for production/preview/development.

Telegram bot (server only, production; see below):

| Variable | Notes |
|---|---|
| `TELEGRAM_BOT_TOKEN` | from BotFather |
| `TELEGRAM_CHANNEL_ID` | `@channelhandle` or numeric `-100...` id of the event channel |
| `TELEGRAM_WEBHOOK_SECRET` | random string; passed to `setWebhook` as `secret_token` |
| `CRON_SECRET` | random string; Vercel sends it to the cron routes as `Authorization: Bearer` |

Known limitation (accepted for the event): duplicate sign-ups are not
blocked — reloading and submitting again adds another row. The rate
limits below bound it, and walk-ins mean a double row skews planning,
not entry. Editing the bracelet after signing up does not update the
stored row (the panel says the sign-up stands).

## Guest cookie and rate limits

- **Guest cookie (#13):** the first page visit gets a random `g5_guest` cookie (`HttpOnly`, 60 days) from `src/proxy.ts`. It isn't an account. It's only used for rate limits and for "your own posts" on the wall.
- **Sign-up limits (#11):** at most 10 per minute per IP and 5 per hour per guest cookie. The counters are shared across all Vercel instances because they live in Postgres (`rate_limits`, migration 0009). Keys are HMACs, so no IP is stored. If the limiter can't be reached, sign-ups are allowed and the failure is logged.
- **Wall limits (#14):** 20 posts per minute per IP and 5 per 10 minutes per guest cookie. Every action has its own counters; keys look like `signup:ip:<hmac>`, `wall:guest:<hmac>`.
- **Retention:** counters older than a day are purged daily by the `/api/cron/purge-rate-limits` cron (03:00 SGT, `CRON_SECRET`).
- **Checks:**
  - database: `supabase db query --linked -f supabase/tests/rate_limit_acceptance.sql`
  - limiter logic, no database: `node --no-warnings --conditions=react-server --experimental-strip-types --import ./scripts/ts-alias-hooks.mjs scripts/rate-limit-check.mjs`
  - data layer from a script: `node --no-warnings --env-file=.env.local --conditions=react-server --experimental-strip-types scripts/dal-check.mjs` (flood helpers: `... dal-check.mjs seed|clear signup|wall|gallery ip|guest <value>`)

## Friendship wall

`/wall` (#14): post a message (280 characters, name optional), read everyone's, delete your own from the same device. Copy is in `content/wall.json`.

- **Filter:** `content/stopwords.txt` (format at the top of the file). A post that matches isn't stored and the poster is asked to rephrase. Check it with `node --no-warnings --conditions=react-server --experimental-strip-types --import ./scripts/ts-alias-hooks.mjs scripts/stopwords-check.mjs`.
- **Moderation:** to remove any post, delete its row in the Supabase Table Editor (`wall_posts`).
- **Kill switch:** set `event_config.wall_open` to `false` to close posting (the wall stays readable).
- **Retention:** posts are public and may carry a name, so the table is emptied by 19 Dec with the sign-ups: `delete from public.wall_posts;`.
- **Database check:** `supabase db query --linked -f supabase/tests/wall_acceptance.sql` (rolled back).

## Poster QR

`assets/poster-qr.png` (410×410) encodes https://enroot-g5.vercel.app/ (decoded and checked 2026-11-03).

## Telegram bot

Features (#18): `/count` (live sign-up count), charm of the day (09:00 SGT,
1 to 18 Nov), and event-day nudges (19 Nov at 09:00 and 16:00 SGT). The crons
are in `vercel.json` and the copy is in `content/bot.json`. Hobby crons fire
somewhere within the scheduled hour.

One-time setup:

1. In Telegram, ask @BotFather to create a bot with `/newbot`, and keep the token.
2. Create a public channel for the event, then add the bot as an admin that can post messages.
3. Set the four variables above in Vercel (Production), then redeploy.
4. Register the webhook:
   ```bash
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setWebhook" \
     -d url=https://enroot-g5.vercel.app/api/telegram/webhook \
     -d secret_token=$TELEGRAM_WEBHOOK_SECRET \
     -d 'allowed_updates=["message"]'
   curl "https://api.telegram.org/bot$TELEGRAM_BOT_TOKEN/setMyCommands" \
     -H 'content-type: application/json' \
     -d '{"commands":[{"command":"count","description":"How many people are coming"}]}'
   ```

To preview a post without sending it, run:

```bash
curl -H "Authorization: Bearer $CRON_SECRET" \
  "https://enroot-g5.vercel.app/api/telegram/morning?date=2026-11-05&dryRun=1"
```

Drop `dryRun=1` to really post (the date override still applies).
After adding or replacing a charm, re-run `node scripts/charms-to-photo.mjs`.

## Deploy

Production: https://enroot-g5.vercel.app/ (Vercel). Pushes to `main` deploy
to production automatically; other branches get preview URLs.
