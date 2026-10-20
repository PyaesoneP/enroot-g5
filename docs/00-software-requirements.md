# 0. Software Requirements (SRS)

**Status:** Draft for team review. **Date:** 2026-10-06 (activity updated
2026-10-20). **Inputs:** student
feedback survey (32 responses at close on 2026-10-06; 33 by the 2026-10-07 review, see Section 7), Group 5 team meeting notes
(2026-10-06), confirmed event logistics (Thu 19 Nov 2026, Root Cove;
date/venue updated 2026-10-06 from 20 Nov / Campus Center),
the Event Proposal Form (EPF) draft of 2026-10-20, ROOTech project brief.

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

The single confirmed on-site activity is **Charm & Chatter: Italian charm
friendship bracelet making**, done in pairs, 7:00pm to 9:00pm (EPF draft,
2026-10-20). Each participant gets an 18-link stainless steel base bracelet
and swaps 4 plain links for photo charms. It replaces stress ball making
(decided 2026-10-06); trivia night was cut earlier (see Section 9).

Out of scope: backend business logic beyond the event, payment, accounts,
content editing outside the repo, and any feature that needs more than the
free tiers of Vercel and Supabase.

## 2. Actors

| Actor | Description |
|---|---|
| Visitor | Anonymous student on a phone. Views the site, signs up, posts to the wall, plays the interactive. No account. |
| Bot user | Telegram user who chats with the event bot (RSVP count, daily message). |
| Maintainer | One student (Pyae). Edits content files, merges PRs, deploys, moderates the wall. |
| On-site organizer | Team members running the four vibe tables; read the sign-up sheet (exported from the store) to plan tables and charm stock per vibe. |

## 3. Functional requirements

- **F-01 Event overview above the fold.** The landing page must show, without
  scrolling: the theme (Friendship), the date (19 Nov 2026), the venue
  (Root Cove), and a one-line summary of what happens at the event.
  *Evidence: 91% of survey respondents (N=32 at close) said they would check the date/venue
  or what is happening first.*
- **F-02 Activity page.** A dedicated section describing Charm & Chatter:
  how it works (pairs; each person builds their own 18-link bracelet and
  picks 4 charms that reflect their personality), the materials, and the
  day's schedule (7:00pm to 9:00pm, Root Cove). Pairing rule: match by
  preference (team decision 2026-10-07), made concrete on 2026-10-20 as
  **match by vibe** (F-05a): one table per vibe, pairs form at the table,
  leftovers pair with a neighbouring table, walk-ins pick a vibe card at the
  door. Revisit if it does not work on the day.
- **F-03 Sign-up (RSVP).** A sign-up form (name optional, group size, and the
  visitor's bracelet picks with their vibe, F-05a) so the team can plan
  tables, charm stock and headcount. Walk-ins remain possible; sign-up is a planning tool, not a gate.
  A **live sign-up count** is displayed on the landing page.
  *Evidence: 56% of bot-survey respondents (18 of 32) wanted a live RSVP count; the
  EPF sizes materials for 30 participants (30 base bracelets, 120 charms).*
- **F-04 Friendship wall.** Visitors can post a short message (280 chars max),
  read the list of all messages, and delete their own post. No login.
  *Evidence: 76% of respondents (25 of 33) said they would post or maybe post.*
- **F-05 Interactive activity module (pluggable).** The site carries exactly
  one interactive slot, loaded from a single config pointer (ADR-005).
  **Module v1: "Make your bracelet"** (`/make`): the visitor picks 4 of the
  event's actual charm designs, places each on any of the 18 links, and
  sees the result on a rendered bracelet. The picks and their positions are
  kept in the page URL (shareable, no store needed) and later saved as an
  output. This doubles as the preference
  collection for on-site pairing (F-03) and the "life of its own" the
  brief asks for. (Replaces "What stress ball are you?" with the
  2026-10-20 activity change, and the "What charm are you?" quiz idea by
  team request the same day; no module code had been written yet.)
- **F-05a Vibe.** Exact matching on charms and positions is impossible
  (99 designs on 18 links), so pairing uses a coarse group. Each charm's
  style family belongs to one of four **vibes** (Sweet: love + flowers;
  Playful: animals + fun; Dreamy: sky; Bold: patterns + words), set in
  `content/charms.json`. A finished bracelet's vibe is the one most of its 4
  charms belong to; on a tie, the tied vibe with a charm nearest the front
  wins. The builder shows the vibe once 4 charms are on. Four groups (not
  five) keep about 7 to 8 people per table at ~30 turnout, so few tables end
  on an odd number. The build fails if a style family is in no vibe or in
  two.
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
- **F-09 Telegram bot.** A Python bot over the shared store with three
  confirmed features (#18): (a) `/count`, the **live sign-up count**,
  (b) **charm of the day**, a daily post (1 to 18 Nov) showing one charm with
  a friendship line, a countdown and a link that opens the builder with that
  charm, (c) **event-day nudges** on 19 Nov (morning and late afternoon).
  (b) is the survey's daily friendship message, tied to the activity. *Evidence (32 answered): 56% live RSVP count (18), 47% daily message
  (15). Trivia/quiz (44%, 14) is recorded as a signal but not adopted
  (Section 9).*
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
- **N-07 Scale.** One-day event, roughly 30 students on site (EPF expected
  turnout, in pairs at four vibe tables of 7 to 8), a few hundred site visits across the publicity window. Free tiers must
  cover this; no provisioning work.
- **N-08 AI usage rule (brief).** AI is allowed in the build but the event
  copy must be hand-written for this team and the interactive must be
  customized to have "life of its own." No generic machine-generated pages.

## 5. Constraints

| Constraint | Value / source |
|---|---|
| Event budget | S$300 (S$200 OSL seed fund + S$100 club income), EPF draft 2026-10-20 (was S$200 in the Phase 2 briefing). Materials planned at S$184.50 to S$232.50. Site + bot must cost S$0 (free tiers). |
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

## 7. Requirements evidence (survey)

The survey closed on 2026-10-06 with 32 responses; a 33rd arrived before the
2026-10-07 review. Each row states the N it is based on. Rows marked "at close"
were not re-counted with the 33rd response. Percentages are rounded from the
counts shown.

| Question | N | Result | Drives |
|---|---|---|---|
| Check first on the site | 32 (at close) | 47% what is happening, 44% date/venue, 6% food/other | F-01 (both above the fold) |
| Most fun interactive | 33 | 58% stress ball (19 of 33); friendship band second (34% at close, N=32) | F-05 (module v1 was squishy; after the 2026-10-20 change the event is a friendship bracelet, close to the survey's second choice) |
| Would you post on a public wall | 33 | 55% yes (18), 21% maybe (7), 24% no / "too public" (8) | F-04 (kept: 76% yes/maybe) |
| Useful bot features (multi) | 32 answered | 56% live RSVP count (18), 47% daily message (15), 44% trivia/quiz (14), 19% nothing (6) | F-09 (RSVP count + daily message) |
| Free text | 32 (at close) | 16% food, 6% music/song requests, 16% positive/nothing | Food handled by event logistics (budget), not the site; music is out of scope |

## 8. Traceability

| Req | ADR | Issue | Milestone |
|---|---|---|---|
| F-01 | 002, 003 | #7 | M1 |
| F-02 | 003, 005 | #8 | M1 |
| F-03 | 004 | #15 | M2 |
| F-04 | 004, 008, 009 | #14, #13 | M2 |
| F-05 | 005 | #9, #10 | M1 |
| F-05a | 003, 005 | #10, #15 | M1 |
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
  supported by 44% (14 of 32) of bot-survey respondents, but dropped by team decision the
  same day: the event was stress ball making only. Consequences: issue #17
  (leaderboard) and the `scores` table are dropped; the bot's trivia command
  is not built.
- **Stress ball (squishy) making.** The survey's favourite (58%) and the
  activity decided on 2026-10-06. Replaced by Charm & Chatter (Italian charm
  friendship bracelets) in the EPF draft of 2026-10-20. Consequences: the
  four texture tables, table prizes and the "What stress ball are you?"
  quiz are dropped; issues #5, #7, #8, #10 and #15 were re-scoped. This is
  the activity swap ADR-005 was written for; because no module code existed
  yet, the cost was copy and issue edits only.
- **Friendship band designer (as a digital designer).** Survey's second
  choice (34% at close). The physical event is now a friendship bracelet,
  so the site's interactive is the charm quiz rather than a band designer.

**Open:**

- Food: the loudest free-text ask (16%) is an event-budget decision (S$300),
  not a site requirement. The site can list snacks on the activity page once
  the team decides (F-10 makes that a one-line edit).
- ADR-010 (bot runtime): accepted 2026-10-20, Vercel webhook + cron. Every
  bot feature is on-demand or scheduled, so no VPS.

- EPF section E (personal data) must be ticked "Yes" if the RSVP collects
  any personal data (tracked in #22). The EPF is due to SG Events by
  Thu 22 Oct (4 weeks before the event).

**Venue change (2026-10-06):** event moved from Fri 20 Nov / Campus Center to
**Thu 19 Nov / Root Cove**. All dates and venue text in this document and in
`content/` must reflect the new values; any poster or IG draft already
produced with the old values needs a revision pass before publicity goes out
on 1 Nov.
