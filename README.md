# EnROOT Group 5 - Event Site

Event site for **EnROOT Group 5** (15th ROOT, SUTD), part of the 15th ROOT
EnROOT trial cohort.

## The event

- **Theme:** Friendship
- **Date:** Friday, 20 November 2026
- **Venue:** Campus Center, SUTD
- **Activities:** bracelet making, painting, + one interactive activity
 (pluggable: friendship-band designer / squeeze-ball maker, team decision
 pending)

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

The live page is currently the **build shell** (timeline + placeholder hero).
The theme was drawn 6 Oct (Friendship); the real event site is the next build:
landing + activities + the pluggable interactive + friendship wall + RSVP, per
the ADRs above.

## Requirements (from the ROOTech brief)

- **Front-end:** Next.js + Tailwind
- **Responsive:** mobile-first layout, verified at phone / tablet / desktop widths
- **GitHub repo:** this repo
- **Backend:** not required for the shell; the target design uses Supabase
 (see ADR-004) for the wall / RSVP / saved outputs / scores
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
4. **Theme drawn 6 Oct (Friendship); event = 20 Nov, Campus Center.** Documented
  the target architecture in `docs/` (4 docs + ADR log).
5. **Next:** build the real event site (landing, activities, pluggable
  interactive, wall, RSVP), stand up Supabase, deploy. If the event has
  trivia/minigame, run the Python Telegram bot (ADR-010 fixes its runtime).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Push to GitHub, connect the repo to Vercel, and it deploys automatically.
