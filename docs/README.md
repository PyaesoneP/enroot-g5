# Architecture Docs

This folder documents the architecture of the **EnROOT Group 5 event website**
(target system, including the companion Telegram bot). It is part of the
ROOTech evaluation: the team is graded on **product and process**, and these
docs are the process record of *how* and *why* the system is shaped the way it
is.

## The four documents

| Doc | Question it answers | Format |
|---|---|---|
| [1. Architectural Characteristics](./01-architectural-characteristics.md) | What qualities does the system need to have, and which decisions satisfy them? | Focused quality-attribute list (4 essentials) |
| [2. Architectural Decisions](./02-architectural-decisions.md) | What did we decide, why, and what did it cost? | ADR log (Status / Context / Decision / Consequences / Alternatives) |
| [3. Logical Components](./03-logical-components.md) | What is the system made of? | Component decomposition (Mermaid) + descriptions |
| [4. Architectural Style](./04-architectural-style.md) | What pattern(s) is the system built on, and why? | Deep taxonomy mapping (hybrid style) |

## Scope note

The docs describe the **target system**: the final event site (landing +
activities + the interactive activity module + the friendship wall + saved
outputs + RSVP) and the **Telegram bot** that shares its data store. The
initial build shipped was a placeholder shell (timeline page); this is the
design the build moves toward.

The one open item is the **bot's runtime** (see ADR-010, status: pending),
blocked on deciding what the bot does at the event.

## Conventions

- ADRs are numbered in the order they were made (001..010). "Accepted" =
  decided and in effect; "Pending" = a real decision is owed, with a known
  blocker.
- Component names in Doc 3 match the names used in Doc 2 (Consequences) and
  Doc 4 (style mapping).
- Mermaid diagrams render on GitHub. If you read this in a raw viewer, the
  diagram source is the block itself.
