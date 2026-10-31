# EnROOT Group 5 - Event Site

Event site for **EnROOT Group 5** (15th ROOT, SUTD), part of the 15th ROOT
EnROOT trial cohort.

**Live site:** https://enroot-g5.vercel.app/
(poster QR: `public/live-qr.png`, served at `/live-qr.png`)

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
- Telegram bot (Python), shared store, Vercel webhook + cron (ADR-010)

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
  stand up Supabase, deploy. Stretch: wall, gallery, and the Python Telegram
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

Known limitation (accepted for the event): duplicate sign-ups are not
blocked — reloading and submitting again adds another row. The per-IP
rate limit bounds it, and walk-ins mean a double row skews planning,
not entry. Editing the bracelet after signing up does not update the
stored row (the panel says the sign-up stands).

## Deploy

Production: https://enroot-g5.vercel.app/ (Vercel). Pushes to `main` deploy
to production automatically; other branches get preview URLs.
