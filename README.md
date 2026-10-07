# EnROOT Group 5 - Event Site

Event site for **EnROOT Group 5** (15th ROOT, SUTD), part of the 15th ROOT
EnROOT trial cohort.

**Live site:** https://enroot-g5.vercel.app/

## The event

- **Theme:** Friendship
- **Date:** Thursday, 19 November 2026
- **Venue:** Root Cove, SUTD
- **Activities:** stress ball (squishy) making in pairs at four texture
  tables (team decision 2026-10-06; trivia night and the band designer cut,
  see `docs/00-software-requirements.md` section 9). The site's interactive is
  a pluggable module (ADR-005); v1 = "What stress ball are you?"

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
the real event site is the next build: landing + stress ball activity page +
"What stress ball are you?" quiz + RSVP for the first milestone, then the
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
- Telegram bot (Python), shared store, runtime pending (ADR-010)

## Process

1. Scaffolded the app (Next.js + TS + Tailwind + ESLint).
2. Replaced the boilerplate with a clean, responsive shell: header, timeline,
  placeholder hero. Dark-mode aware.
3. Committed to GitHub, deployed to Vercel for a live URL.
4. **Theme drawn 6 Oct (Friendship); event = 19 Nov, Root Cove** (moved from
   20 Nov / Campus Center on 6 Oct). Documented
  the target architecture in `docs/` (4 docs + ADR log).
5. **Next:** build the real event site (landing, activity page, quiz, RSVP),
  stand up Supabase, deploy. Stretch: wall, gallery, and the Python Telegram
  bot (live count + daily message; ADR-010 fixes its runtime).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Production: https://enroot-g5.vercel.app/ (Vercel). Pushes to `main` deploy
to production automatically; other branches get preview URLs.
