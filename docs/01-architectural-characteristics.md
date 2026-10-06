# 1. Architectural Characteristics

Architectural characteristics (often written as the "-ilities": maintainability,
scalability, security, ...) are the **quality attributes** a system must satisfy.
They are the things that make a design good *beyond* "it works": they decide how
easy the system is to change, how safe it is to expose to strangers, how little
infra it needs, and whether the people using it can actually use it.

For a one-day, single-team, single-maintainer event site with a public
write-access wall and a companion bot, most textbook -ilities are noise
(scalability to millions, high availability, cross-platform portability). We
deliberately keep **four**, because each one maps to a real constraint of this
project:

- **Maintainability** — one person owns the whole system.
- **Security** — strangers on the internet can write to it.
- **Deployability** — there is no server to babysit, and no one to babysit it.
- **Usability** — the audience arrives on phones.

Each entry below states the quality, why it matters *here*, and the specific
decisions (see [02-architectural-decisions](./02-architectural-decisions.md))
that satisfy it.

---

## 1.1 Maintainability

**The quality:** the cost of making a change is low. Editing copy, swapping the
activity, or adding a feature does not require refactoring unrelated parts.

**Why it matters here:** Pyae is the **sole** maintainer. There is no team to
absorb a bad design; a confusing codebase is a personal tax on every change up
to and past event day. The single biggest maintainability risk in this project is
the **uncommitted activity**: the team may build bracelets *or* squeeze balls.
The design must let that swap happen without touching anything else.

**Satisfied by:**

- **ADR-003 (content-as-code, no CMS):** all human-editable copy lives in plain
  JSON/markdown at the repo root. A change is a text edit + a commit, versioned
  in git, reviewable in a diff. No admin panel to log into, no schema to fight.
- **ADR-005 (pluggable activity module, strategy pattern):** the interactive
  feature is isolated behind a small interface (`render(state)`, `validate(input)`,
  `serialize(state)`). "Band designer" and "squeeze-ball maker" are
  interchangeable implementations. Swapping = point one config line at a
  different module.
- **ADR-004 (data layer behind a thin interface):** the UI and the bot do not
  call Supabase directly; they call a small typed data-access module. If the
  store ever changes (Supabase -> KV, or a schema migration), the blast radius is
  one file, not every component.
- **ADR-001 (Next.js + TypeScript):** type errors at build time catch the
  "I renamed a field and broke three call sites" class of bug before it ships.

## 1.2 Security

**The quality:** the system does not let untrusted input corrupt it, expose
private data, or become an attack vector.

**Why it matters here:** this is the one characteristic where the stakes are
real. The friendship wall and RSVP are **publicly and anonymously writable** by
up to a few hundred students who have no account and no incentive to be
well-behaved. The system is also behind a free-tier BaaS, so the defaults have to
be right, not assumed.

**Satisfied by:**

- **ADR-004 (Supabase Row Level Security):** the Postgres database is never
  exposed raw. Each table carries an RLS policy that says exactly who can
  insert/select/update/delete what. "Anyone can read the wall" is an explicit
  policy, not an accident of an open connection string.
- **ADR-009 (UGC guardrails):** all wall/RSVP input is validated and
  length-capped on the server (not just the client), rendered through the
  framework's escaping (no raw HTML injection), and rate-limited per IP so a
  single device can't flood the wall. A short server-side word-list filter catches
  obvious abuse.
- **ADR-008 (anonymous/lightweight auth):** there is no real "login" to attack.
  Identity for wall posts is an anonymous, opaque token in a browser cookie, not
  a password. There is nothing credential-shaped for an attacker to target.
- **ADR-006 / ADR-010 (the bot is a server, not a client):** the bot talks to
  Supabase from server-side code with a service-role key that never reaches the
  browser. The client-facing surface stays minimal.

## 1.3 Deployability

**The quality:** getting a change from "done locally" to "live for everyone"
is fast and requires no infrastructure management.

**Why it matters here:** the maintainer is a first-year student with a real
courseload. The system must deploy with **zero servers to manage** and zero
downtime during the publicity window (1 Nov -> 20 Nov). "I have to SSH into a
box and restart a process" is a deployability failure for this team.

**Satisfied by:**

- **ADR-007 (Vercel serverless deployment):** pushing to `main` produces a
  preview URL; merging produces the live site. No VM, no systemd, no cert
  renewal, no "the server is down". Vercel owns the runtime.
- **ADR-002 (static-first / SSG):** the bulk of the site (landing, activities,
  copy) is built into static HTML at build time. There is no app server to keep
  alive; the dynamic parts are just a few serverless functions that scale from
  zero.
- **ADR-004 (Supabase is a service, not infra):** the database is a managed
  product with a free tier. "Deploying the data layer" means nothing, because it
  is already deployed.

## 1.4 Usability

**The quality:** a target user can do the thing they came to do, quickly, on
the device they have, without instruction.

**Why it matters here:** the brief requires a **responsive, mobile-first** site,
and the realistic audience (SUTD students at a campus event) will open it on a
phone, in a crowd, on event day. A desktop-only layout is a usability failure
regardless of how clean the code is.

**Satisfied by:**

- **ADR-002 / ADR-007 (SSG + fast static delivery):** the page is static HTML,
  so it loads fast on the weak, variable connectivity of a campus crowd.
- **Component design (Doc 3):** every screen is a single column that scales from
  360 px to desktop. The interactive activity and the wall are reachable without
  horizontal scrolling or pinch-zoom.
- **ADR-009 (low-friction input):** wall posts are one short field, no signup.
  The "create a memory" path is two taps. Friction is the enemy of participation
  at an event.

---

## Deliberately not on the list

- **Scalability** — the load ceiling is ~a few hundred students over one
  evening, on a static site + a free-tier BaaS. Not a real constraint.
- **Performance (as a separate item)** — it is a means to usability here
  (fast load on phones), not an end in itself. Folded into 1.4.
- **Testability / Reliability / Portability** — desirable, but not load-bearing
  for a one-day event owned by one person. We would promote them if the system
  outlived the event.
