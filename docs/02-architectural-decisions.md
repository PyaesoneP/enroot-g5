# 2. Architectural Decisions

An **Architecture Decision Record (ADR)** captures a *significant* decision: the
context that forced it, the choice made, the consequences (good and bad), and the
alternatives considered. We keep them because this project is graded on
**process**, and because the maintainer (one person) will forget *why* in six
months.

Conventions:

- Numbered in the order the decision was made: **ADR-001 .. ADR-010**.
- Each record has: **Status** (Accepted / Pending / Superseded), **Context**,
 **Decision**, **Consequences** (positive + negative + open), **Alternatives**.
- "Pending" is a legitimate status: it means a real decision is owed and the
 blocker is named. We do not ship a fake "Accepted" to look tidy.

---

## ADR-001 - Next.js (App Router) + TypeScript

**Status:** Accepted

**Context.** The ROOTech brief requires a responsive front end; Next.js +
Tailwind is the recommended stack, and the team was already scaffolding on it.
The project must be built and maintained by one first-year student on top of a
full course load, and the deliverable is a public URL, not a local app.

**Decision.** Build on **Next.js (App Router) with TypeScript**. Pages are
App-Router route modules; shared UI is React components; all data types are
explicit TS interfaces. Tailwind 4 is the styling layer.

**Consequences.**

+ TypeScript catches refactoring errors at build time (supports maintainability,
 Doc 1 1.1).
+ The App Router gives us both server-rendered pages and on-demand serverless
 functions in one codebase (enables ADR-002 and ADR-007 without a second
 backend service).
+ Vercel's deployment path is the zero-effort option (ADR-007).
- Adds a build step and a framework to learn/maintain; Next.js changes its
 conventions between versions (the repo carries an agent note pointing at the
 in-package docs).
- "The App Router" is a moving target; we pin to the installed major (16.x) and
 read the in-package docs before non-trivial changes.

**Alternatives.**

- **Plain Vite + React SPA.** Faster to learn, but no server functions; we would
 need a separate backend for the dynamic parts (wall, RSVP, bot data), which
 defeats the "no server to babysit" goal (ADR-007). Rejected.
- **Pages Router.** Stable but legacy; App Router is where the framework and
 the docs are headed. Rejected.

---

## ADR-002 - Static-first (SSG) for all editorial content

**Status:** Accepted

**Context.** Most of the site (landing, about, activity descriptions, schedule)
changes rarely and is read by everyone. The dynamic parts (wall, RSVP, saved
outputs, scores) are a small number of data endpoints. Serving everything
dynamically would cost latency for content that is effectively constant, and
would put the whole site behind always-on compute.

**Decision.** Render all editorial pages **statically at build time**. Only the
data endpoints (wall list/post, RSVP, saved outputs, scores) are dynamic, served
by a few serverless functions. The site loads as HTML and hydrates; dynamic
regions fetch data client-side or stream in.

**Consequences.**

+ Fast first load on phones (usability, Doc 1 1.4); no app server to keep alive
 (deployability, Doc 1 1.3).
+ Content edits are a rebuild, not a config change, so they are reviewable in git
 (ADR-003).
- Content changes require a deploy rather than an instant DB edit. For this team
 (one editor, low change frequency) that is a feature, not a bug.
- The "static" and "dynamic" boundary is a real seam; it must be kept clean so we
 don't accidentally make a page dynamic.

**Alternatives.**

- **Server-side render every request.** Simpler mental model, but wastes compute
 on constant content and couples the whole site to the data store's uptime.
 Rejected.
- **Client-only SPA fetching everything.** Slower first paint on phones; no
 SEO/no-JS fallback. Rejected.

---

## ADR-003 - Content-as-code, no CMS

**Status:** Accepted

**Context.** There is exactly one person who edits copy (Pyae). A CMS (admin
panel, roles, a second service to host) would add a login, a schema, and an
attack surface for a single editor who is already comfortable with git.

**Decision.** All human-editable content (event copy, activity blurbs, schedule,
theme text) lives in **plain JSON/markdown files at the repo root** (e.g.
`content/`). A change is an edit to a file and a commit. The build reads these
files. No CMS, no admin UI, no content API.

**Consequences.**

+ Zero extra services, zero editor accounts, zero extra credentials (security,
 Doc 1 1.2).
+ Every content change is versioned and reviewable in a git diff.
+ The files are the single source of truth; nothing can drift between "what the
 panel says" and "what ships".
- Non-technical editors cannot edit without git. Acceptable: the only editor is
 comfortable with it. If the team later wants non-developer editors, revisit
 (this is the one decision most likely to be superseded, and the data-layer
 abstraction in ADR-004 would make a later CMS a contained change).

**Alternatives.**

- **A hosted CMS (Sanity/Contentful/etc.).** Adds a service, accounts, and cost;
 overkill for one editor. Rejected.
- **Supabase as a content store (Postgres rows edited in its table UI).**
 Possible, but edits become un-versioned UI clicks and content becomes
 indistinguishable from app data. Rejected.

---

## ADR-004 - Supabase (BaaS) as the data store, behind a data-layer interface

**Status:** Accepted

**Context.** The target system persists four kinds of data (RSVP, friendship
wall, saved interactive outputs, high scores) and is used by two consumers: the
web site and the Telegram bot (ADR-006). The ROOTech stack lists Supabase. The
team is solo and cannot run its own database server (deployability, Doc 1 1.3),
and public write access must be tightly controlled (security, Doc 1 1.2).

**Decision.** Use **Supabase** (managed Postgres + Row Level Security + Auth +
Storage) as the single data store. The site and the bot do **not** call
Supabase directly; they go through a small, typed **data-access layer** (a set
of functions like `listWall()`, `postWall()`, `rsvp()`, `saveOutput()`,
`submitScore()`). The rest of the system knows about *operations*, not about
Supabase.

**Consequences.**

+ A real, relational database with free tier and zero infra to manage.
+ RLS gives per-table, per-operation security policy (Doc 1 1.2).
+ The data-layer interface is the seam that keeps ADR-005's pluggable design and
 the bot (ADR-006) decoupled from the concrete store. Swapping stores later is a
 one-module change.
+ One store for two consumers (ADR-006) means no sync/replication between
 systems.
- Supabase is a third-party free-tier dependency; a tier change or outage affects
 the dynamic parts (not the static site).
- The data layer must be kept honest: leaking a raw Supabase client into a
 component defeats the abstraction.

**Alternatives.**

- **Vercel KV / Vercel Postgres.** Less configuration, but a weaker fit for the
 relational + per-row-policy model we want, and it would diverge from the
 ROOTech-recommended stack named in the brief.
- **Self-hosted Postgres on a VPS.** Full control, but we cannot run a VPS
 (see ADR-010) and it violates deployability. Rejected.
- **Firebase.** Viable BaaS, but the brief/stack points to Supabase and we would
 be maintaining a second mental model for no benefit. Rejected.

---

## ADR-005 - Pluggable activity module (Strategy pattern)

**Status:** Accepted

**Context.** The interactive "life of its own" feature is **not yet decided** at
the team level: it may be bracelet/band making, squeeze-ball making, or
something else. The architecture must not hard-wire one activity, because the
swap is certain to happen before or after the event and would otherwise ripple
through the UI, the data layer, and the bot.

**Decision.** Model the interactive as a **pluggable activity module** behind a
fixed interface. A module declares (at minimum) an `id`, a human `name`, a
`render(state)` for its UI, a `validate(input)` for its inputs, and a
`serialize(state)` for the form its result is stored/shared in. The site loads
the active module from a single config pointer; the data layer stores
`activity_id` + the serialized result, so it is agnostic to *which* activity is
active. Switching activities changes the config pointer, not the surrounding
system.

**Consequences.**

+ The activity swap is a contained, low-risk change (the single biggest
 maintainability risk, Doc 1 1.1, is directly addressed).
+ Stored outputs carry their `activity_id`, so if the activity changes, old
 outputs remain interpretable (a band pattern from October is not corrupted by a
 squeeze-ball change in November).
+ The bot (ADR-006) and any future feature can reference "the activity" without
 knowing its specifics.
- Slightly more indirection than a hard-coded component. For a one-person team
 this is worth it given the swap is guaranteed.
- The interface must be designed to fit at least two candidate activities (band,
 squeeze-ball) to be credible; we keep both in mind while defining it.

**Alternatives.**

- **Hard-code the chosen activity.** Simplest, but the moment the team picks
 squeeze-balls the UI, storage, and bot all change. Rejected: the swap is
 guaranteed, so we pay for it once instead of repeatedly.
- **A full plugin system with a manifest/registry.** Over-engineered for exactly
 one slot. Rejected in favor of a single config pointer.

---

## ADR-006 - One shared data store for the site and the bot

**Status:** Accepted

**Context.** The project includes a **Telegram bot** (optional extra, recommended
by the brief) and the site. Two separate stores would require syncing and would
duplicate the data-layer work. A shared store means the bot and the site see the
same wall, the same RSVP, the same outputs.

**Decision.** The site and the bot are **two front ends over the same
Supabase store** (ADR-004). The bot is an *integration* component, not a peer
service with its own database. It talks to the store with its own
server-side credentials (never exposed to the client) and is itself a
pluggable feature (its exact behavior is undecided, ADR-010).

**Consequences.**

+ No data sync between two systems; the "blackboard" is the store itself.
+ The bot becomes genuinely useful (it can post to the wall, mirror the RSVP
 count, or host a trivia game that writes scores into the same table the site
 reads).
+ One store to secure (RLS covers both consumers).
- The bot and the site must agree on schema; a change to a table affects both.
 The data layer (ADR-004) is where that agreement is enforced.
- The bot needs a runtime (ADR-010), which is the one pending decision in this
 architecture.

**Alternatives.**

- **Separate stores per consumer.** No, it doubles the data work and creates a
 sync problem for a system this small.
- **Bot-only (no site data).** The brief wants a *site*; a bot that can't touch
 the site's data is a demo, not an integration. Rejected.

---

## ADR-007 - Vercel serverless deployment

**Status:** Accepted

**Context.** The maintainer cannot run a server (ADR-010) and the project must
deploy with zero infra (deployability, Doc 1 1.3). The deliverable is a live
URL, and Vercel is the natural target for Next.js.

**Decision.** Deploy on **Vercel**: `main` -> production, branches -> preview
URLs. Dynamic endpoints run as **serverless functions**; static content is
served from the CDN (ADR-002). There is no long-running web server owned by the
team.

**Consequences.**

+ Push-to-deploy, zero servers, automatic TLS, preview URLs for review.
+ The "is it up?" question mostly disappears; the static site is on a CDN.
+ Free tier comfortably covers a one-day, few-hundred-user event.
- We are coupled to Vercel's runtime (function timeout, cold starts on the
 dynamic endpoints). Fine at this scale; revisit if the bot needs a persistent
 connection (see ADR-010).
- A Vercel outage is an outage; nothing we can self-recover from.

**Alternatives.**

- **A VPS with Node + nginx.** Full control, but we cannot run a VPS and it
 violates deployability. Rejected.
- **Static hosting only (e.g. GitHub Pages).** Works for the static parts, but
 no serverless functions for the dynamic ones; we would need a third backend.
 Rejected.

---

## ADR-008 - Anonymous, lightweight identity for wall + RSVP

**Status:** Accepted

**Context.** We want low-friction participation (no signup; Doc 1 1.4) but
still want (a) to prevent a single device from spamming the wall unboundedly and
(b) to let a user edit/remove *their* post. Real accounts (email, OAuth) add
friction that kills participation at an event.

**Decision.** Identity is an **anonymous, opaque token** issued on first visit
and stored in a cookie (a "guest identity"). It is *only* used for rate-limiting
and for scoping "your posts" (edit/delete own wall post). It is **not** a
password, not tied to a person, and resettable (clearing the cookie = a new
anonymous identity). Auth for the *client* is Supabase anonymous sign-in; no
credentials are collected.

**Consequences.**

+ Two-tap participation; nothing for an attacker to phish or leak (security,
 Doc 1 1.2).
+ The guest token gives us a per-identity handle for rate limits and ownership
 of posts, without accounts.
- Identity is trivially spoofable (clear cookies). Acceptable: the threat we
 defend against is accidental/spam, not a targeted attacker; RLS + rate limits
 (ADR-009) are the real controls.
- "Edit your post" only works while the cookie lives. Documented, acceptable.

**Alternatives.**

- **Real accounts (email/OAuth).** Stronger identity, but signup friction that
 would tank participation. Rejected.
- **No identity at all (pure IP rate-limit).** Simpler, but no ownership of posts
 and IP is shared on campus Wi-Fi (one hotspot = one IP for a crowd). Rejected.

---

## ADR-009 - UGC guardrails: validate, escape, rate-limit, filter

**Status:** Accepted

**Context.** The wall and RSVP accept **public, anonymous input** from up to a
few hundred strangers (Doc 1 1.2). The default assumption is that some of it
will be junk, some of it will be an attempt to break the page, and a little of
it may be genuinely offensive.

**Decision.** All user-generated input is handled by a fixed pipeline:

1. **Validate server-side** - type, length caps (e.g. wall post <= 280 chars),
  and allowed fields. Client-side checks are convenience only; the server is
  the authority.
2. **Escape on render** - output is rendered as text through the framework's
  escaping; user input is never injected as raw HTML (no stored XSS).
3. **Rate-limit per identity/IP** - a token bucket per guest identity (ADR-008)
  and per IP, so one device cannot flood the wall.
4. **Light content filter** - a short, editable stop-word list (in `content/`,
  i.e. content-as-code) for obvious abuse; a human (the maintainer) can clear a
  post from Supabase's table UI if something slips through.

**Consequences.**

+ The public write surface is bounded: bounded input, bounded rate, escaped
 output, and a human fallback.
+ The stop-word list being in `content/` means tuning it is a normal edit, not a
 code change (ADR-003).
- A stop-word list is blunt: it can over- or under-block. We accept imperfection
 and rely on the human fallback; we do **not** build an ML classifier for a
 one-day event (that would be a maintainability and security cost, not a gain).
- Rate-limit tuning is a guess until event day; we start conservative and can
 raise it.

**Alternatives.**

- **Trust the input / client-side validation only.** One bad payload breaks the
 page for everyone. Rejected.
- **Full moderation queue (hold all posts for approval).** Kills the
 real-time, communal feel of a wall. Rejected; we use the light filter + human
 fallback instead.
- **An ML abuse classifier.** Over-engineered, a moving dependency, and a
 maintainability burden. Rejected.

---

## ADR-010 - Telegram bot runtime

**Status:** **Pending** *(blocked on deciding what the bot does at the event)*

**Context.** The bot (ADR-006) is a Python process that talks to the shared
store. It needs **a place to run**. The team cannot use the Oracle free tier,
and the choice of runtime depends on the bot's behavior, which is not yet
decided. A command/trivia-style bot (request/response) has different needs than
a bot that holds a long-running polling loop.

**Decision (provisional, to be confirmed once bot behavior is fixed).**
Prefer **Vercel serverless** for the bot's HTTP surface (a Telegram **webhook**
endpoint as a serverless function, or a small scheduled function for
time-based posts), reusing ADR-007's zero-infra posture. If the bot proves to
need a **persistent connection** (long-polling, or a loop that must run
continuously), fall back to a **low-cost VPS** (e.g. Hetzner, a few euros/month)
running the bot with a process manager. The decision between these two is
**deliberately left open** until the bot's feature is defined; this ADR records
that it is owed, not that it has been made.

**Consequences (of the two candidate paths).**

+ *Vercel serverless:* zero infra, free tier, consistent with ADR-007; the bot
 is "always on" via webhook without a running process.
- *Vercel serverless:* function cold starts and timeout limits; a long-polling
 bot does not fit well.
+ *Cheap VPS:* a persistent loop is trivial; full control.
- *VPS:* a server to manage (violates deployability, Doc 1 1.3), a cost, and a
 new credential to secure.

**Alternatives.**

- **GitHub Actions on a schedule.** Viable for a *cron-style* bot (post a daily
 "friendship word"), no server needed. A strong candidate if the bot is
 scheduled rather than interactive; not a fit for interactive commands.
- **Oracle free tier.** Ruled out (unavailable to the team).
- **No persistent bot (webhook-only, no loop).** Equivalent to the Vercel
 serverless path.

**Open question that unblocks this ADR:** what does the bot *do* at the event
(interactive trivia? a scheduled daily post? an RSVP mirror?). Once that is
fixed, this ADR is closed by choosing webhook-serverless vs VPS.

---

## Decision index

| # | Decision | Status |
|---|---|---|
| 001 | Next.js App Router + TypeScript | Accepted |
| 002 | Static-first (SSG) for editorial content | Accepted |
| 003 | Content-as-code, no CMS | Accepted |
| 004 | Supabase (BaaS) behind a data-layer interface | Accepted |
| 005 | Pluggable activity module (Strategy) | Accepted |
| 006 | One shared store for site + bot | Accepted |
| 007 | Vercel serverless deployment | Accepted |
| 008 | Anonymous, lightweight identity | Accepted |
| 009 | UGC guardrails (validate/escape/rate-limit/filter) | Accepted |
| 010 | Telegram bot runtime | **Pending** (bot behavior TBD) |
