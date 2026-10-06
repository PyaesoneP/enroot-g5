# 0. Software Requirements (SRS)

**Status:** Draft for team review. **Date:** 2026-10-06. **Inputs:** student
feedback survey (32 responses, closed 2026-10-06), Group 5 team meeting notes
(2026-10-06), confirmed event logistics (Thu 19 Nov 2026, Root Cove;
date/venue updated 2026-10-06 from 20 Nov / Campus Center),
ROOTech project brief.

This document lists *what* the system must do and *why*, in numbered
requirements. How the system is built is covered by docs 01 to 04; this doc is
the bridge between them and the survey evidence. Section 8 traces every
requirement to the ADR(s) and issue(s) that satisfy it.

## 1. Scope

The target system is the **EnROOT Group 5 event website** for the Friendship
event (19 Nov, Root Cove), plus its **companion Telegram bot** that shares
the same data store. The site serves two audiences:

1. **Pre-event (publicity, from 1 Nov):** students learn the theme, date,
   venue, schedule, and sign up.
2. **Event day:** students post to the friendship wall, browse the gallery of
   saved activity outputs, and the bot mirrors the live sign-up count and
   sends a daily friendship message.

The single confirmed on-site activity is **stress ball (squishy) making**,
done in pairs around four texture tables. The team considered and removed
trivia night and the friendship band designer (see Section 9, Cut items).

Out of scope: backend business logic beyond the event, payment, accounts,
content editing outside the repo, and any feature that needs more than the
free tiers of Vercel and Supabase.

## 2. Actors

| Actor | Description |
|---|---|
| Visitor | Anonymous student on a phone. Views the site, signs up, posts to the wall, plays the interactive. No account. |
| Bot user | Telegram user who chats with the event bot (RSVP count, daily message). |
| Maintainer | One student (Pyae). Edits content files, merges PRs, deploys, moderates the wall. |
| On-site organizer | Team members supervising the four tables; read the sign-up sheet (exported from the store) to plan tables and pair students. |

## 3. Functional requirements

- **F-01 Event overview above the fold.** The landing page must show, without
  scrolling: the theme (Friendship), the date (19 Nov 2026), the venue
  (Root Cove), and a one-line summary of what happens at the event.
  *Evidence: 91% of survey respondents said they would check the date/venue
  or what is happening first.*
- **F-02 Activity page.** A dedicated section describing stress ball making:
  how it works (pairs, four texture tables, draw lots to pair with someone
  whose squishy preference matches yours, table prizes), the materials list,
  and the day's schedule.
- **F-03 Sign-up (RSVP).** A sign-up form (name optional, group size, and the
  visitor's squishy preference) so the team can plan tables and expect
  headcount. Walk-ins remain possible; sign-up is a planning tool, not a gate.
  A **live sign-up count** is displayed on the landing page.
  *Evidence: 56% of bot-survey respondents wanted a live RSVP count; meeting
  notes require sign-ups to plan four tables of ~5.*
- **F-04 Friendship wall.** Visitors can post a short message (280 chars max),
  read the list of all messages, and delete their own post. No login.
  *Evidence: 75% of respondents said they would post or maybe post.*
- **F-05 Interactive activity module (pluggable).** The site carries exactly
  one interactive slot, loaded from a single config pointer (ADR-005).
  **Module v1: "What stress ball are you?"** a short preference flow that
  produces the visitor's squishy description, saved as an output. This
  doubles as the preference collection for on-site pairing (F-03) and the
  "life of its own" the brief asks for. The interface must also fit the
  friendship band designer, the next candidate, so a swap is a config change.
- **F-06 Saved outputs gallery.** A public page listing saved activity outputs
  (opt-in per visitor). Outputs carry their activity id so a future activity
  swap does not corrupt past outputs.
- **F-07 Anonymous identity.** On first visit the site issues an opaque guest
  token in a cookie. It is used only for rate limiting and for scoping
  "your posts." Clearing the cookie resets it. No credentials are collected.
- **F-08 UGC guardrails.** All user input passes a fixed pipeline:
  server-side validation (types, length caps), escaping on render (no stored
  XSS), per-identity and per-IP rate limiting, and a small stop-word list
  kept in `content/` with a human fallback in the Supabase table UI.
- **F-09 Telegram bot.** A Python bot over the shared store with two
  confirmed features: (a) a command that returns the **live sign-up count**,
  (b) a **daily friendship message** (scheduled post) on publicity and event
  days. *Evidence: 56% live RSVP count, 44% daily message. Trivia (41%) is
  recorded as a signal but not adopted (Section 9).*
- **F-10 Content as code.** All human-editable copy (event copy, activity
  blurbs, schedule, stop-word list) lives in `content/` as plain files. A
  content change is a git commit, reviewed and versioned.
- **F-11 Data layer.** The site and the bot access the store only through a
  typed data-access layer (operations such as listWall, postWall, rsvp,
  saveOutput). No raw store client in UI code.
- **F-12 Deployment.** `main` deploys to production, branches get preview
  URLs. Dynamic endpoints run as serverless functions; static content from
  the CDN. The bot runs on the runtime selected by ADR-010.

## 4. Non-functional requirements

- **N-01 Responsive (mandatory).** The site must work on phones, tablets, and
  desktops. Most visitors arrive on a phone.
- **N-02 Low friction.** Participating in the wall or the interactive takes at
  most two taps. No accounts, no email capture.
- **N-03 Security.** Row Level Security on every table; user input is never
  rendered as raw HTML; per-identity and per-IP rate limits bound the public
  write surface; no credentials are ever stored or collected.
- **N-04 Performance.** Editorial pages render statically so first load is
  fast on campus Wi-Fi and 4G; only the wall, sign-up, gallery, and bot
  endpoints are dynamic.
- **N-05 Zero-infra deployment.** The team runs no servers. The site lives on
  a CDN plus serverless functions; the bot's runtime must fit the same
  posture or be a single documented low-cost VPS (ADR-010).
- **N-06 One-person maintainability.** A first-year student maintains the
  whole system alongside a full course load. Content edits must not require
  code changes; every significant decision is recorded in the ADR log.
- **N-07 Scale.** One-day event, roughly 30 students on site (four tables of
  ~5), a few hundred site visits across the publicity window. Free tiers must
  cover this; no provisioning work.
- **N-08 AI usage rule (brief).** AI is allowed in the build but the event
  copy must be hand-written for this team and the interactive must be
  customized to have "life of its own." No generic machine-generated pages.

## 5. Constraints

| Constraint | Value / source |
|---|---|
| Event budget | S$200 (S$100 seed + S$100 income), Phase 2 briefing. Site + bot must cost S$0 (free tiers). |
| Publicity start | 1 Nov 2026 (Milestone 1: publicity-ready site). |
| Event day | 19 Nov 2026, Root Cove (Milestone 2). |
| Marketing minimum | 1 poster + 1 IG post. |
| Stack | Next.js + Tailwind recommended by the ROOTech brief; GitHub repo with history required; responsive required; backend optional (we use Supabase); Telegram bot optional (adopted). |
| Process | All work via branch + PR to `main`; nothing merges without review; commits under the maintainer's git identity (AGENTS.md). |
| Maintainer availability | One student, term-time; no long-running services to babysit. |

## 6. External interfaces

| Interface | Role | Notes |
|---|---|---|
| Supabase (managed Postgres) | Single data store: sign-ups, wall, outputs | RLS + anonymous auth; accessed only via the data layer (F-11). Tables: rsvp, wall, outputs. (The `scores` table from the earlier design is dropped with trivia, Section 9.) |
| Vercel | Static CDN + serverless functions; deploy target | main to production, branch previews. |
| Telegram Bot API | Bot messaging surface | Python bot, server-side credentials only. |
| `content/` directory | Content interface | Plain files, git-versioned, read at build and at runtime. |

## 7. Requirements evidence (survey, N=32)

| Question | Result | Drives |
|---|---|---|
| Check first on the site | 47% what is happening, 44% date/venue, 6% food/other | F-01 (both above the fold) |
| Most fun interactive | 59% stress ball, 34% friendship band, 6% other | F-05 (module v1 = squishy; band = next candidate) |
| Would you post on a public wall | 53% yes, 22% maybe, 25% no | F-04 (kept: 75% yes/maybe) |
| Useful bot features (multi) | 56% live RSVP count, 44% daily message, 41% trivia, 19% nothing | F-09 (RSVP count + daily message) |
| Free text | 16% food, 6% music/song requests, 16% positive/nothing | Food handled by event logistics (budget), not the site; music is out of scope |

## 8. Traceability

| Req | ADR | Issue | Milestone |
|---|---|---|---|
| F-01 | 002, 003 | #7 | M1 |
| F-02 | 003, 005 | #8 | M1 |
| F-03 | 004 | #15 | M2 |
| F-04 | 004, 008, 009 | #14, #13 | M2 |
| F-05 | 005 | #9, #10 | M1 |
| F-06 | 004, 005 | #16 | M2 |
| F-07 | 008 | #13 | M2 |
| F-08 | 009 | #11 | M1 |
| F-09 | 006, 010 | #18, #19 | M2 |
| F-10 | 003 | #5 | M1 |
| F-11 | 004 | #4, #6 | M1 |
| F-12 | 007, 010 | #20, #19 | M2 |
| N-01 | 001 | #12 | M1 |
| N-02 | 008 | #13, #14 | M2 |
| N-03 | 004, 009 | #11, #4 | M1 |
| N-04 | 002 | #7, #8 | M1 |
| N-05 | 007, 010 | #20 | M2 |
| N-06 | 003 (+ doc 02) | #5 | M1 |
| N-07 | 004, 007 | #4 | M1 |
| N-08 | (brief rule) | #10 | M1 |

## 9. Cut items and open questions

**Cut (recorded for the process record):**

- **Trivia night / leaderboard.** Proposed in the 2026-10-06 meeting notes and
  supported by 41% of bot-survey respondents, but dropped by team decision the
  same day: the event is stress ball making only. Consequences: issue #17
  (leaderboard) and the `scores` table are dropped; the bot's trivia command
  is not built.
- **Friendship band designer.** Survey's second choice (34%). Superseded by
  the finalized activity; retained as the next candidate behind the
  pluggable-module interface (ADR-005), which is exactly what that ADR was
  written for.

**Open:**

- Food: the loudest free-text ask (16%) is an event-budget decision (S$200),
  not a site requirement. The site can list snacks on the activity page once
  the team decides (F-10 makes that a one-line edit).
- ADR-010 (bot runtime) is now decidable: both confirmed bot features fit
  serverless (an on-demand count command plus a scheduled daily post), which
  favors the Vercel path. Closes with the bot definition issue (#18).

**Venue change (2026-10-06):** event moved from Fri 20 Nov / Campus Center to
**Thu 19 Nov / Root Cove**. All dates and venue text in this document and in
`content/` must reflect the new values; any poster or IG draft already
produced with the old values needs a revision pass before publicity goes out
on 1 Nov.
