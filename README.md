# EnROOT Group 5 — Event Site

Event site for **EnROOT Group 5** (15th ROOT, SUTD), part of the 15th ROOT
EnROOT trial cohort.

## Status

This is the **build shell**. The EnROOT theme and activity are drawn **3–4 Oct**
and the site is built around the drawn theme. Until then the page is an honest
placeholder — timeline + status, not a finished product.

## Requirements (from the ROOTech brief)

- **Front-end:** Next.js + Tailwind ✅
- **Responsive:** mobile-first layout, verified at phone / tablet / desktop widths ✅
- **GitHub repo:** this repo ✅
- **Backend:** not required — none needed for the shell
- **AI usage:** allowed, but the brief asks for customization and "life of its
  own" — no generic machine-generated output. The content is hand-written for
  this specific team and event.

## Stack

- Next.js 16 (App Router, TypeScript)
- Tailwind CSS 4
- Deployed on Vercel

## Process

1. Scaffolded the app (Next.js + TS + Tailwind + ESLint).
2. Replaced the boilerplate with a clean, responsive shell: header, timeline,
   placeholder hero. Dark-mode aware.
3. Committed to GitHub, deployed to Vercel for a live URL.
4. **After the theme is drawn (3–4 Oct):** build the real event site —
   publicity landing page + whatever the drawn theme needs (game, quiz,
   schedule, photo wall). If the event has a trivia/minigame, add a Python
   Telegram bot (optional extra, recommended by the brief).

## Run locally

```bash
npm install
npm run dev
```

Open http://localhost:3000.

## Deploy

Push to GitHub → connect the repo to Vercel → it deploys automatically.