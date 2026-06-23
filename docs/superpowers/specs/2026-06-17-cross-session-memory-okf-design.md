# Cross-Session Memory — OKF-Aligned Knowledge Bundle

**Date:** 2026-06-17
**Status:** Design — awaiting review
**Topic:** Restructure cross-session memory into an Open Knowledge Format (OKF) aligned bundle so a fresh session starts knowing the codebase without re-reading source files or the user re-explaining terms.

## Problem

Starting a new session, the agent does not know what has changed or what project terms mean. It re-reads source files to relearn the codebase (high token cost) and the user re-explains vocabulary every session.

Root causes found in the current setup:

1. **Wrong shape.** Memory is stored as an *event log* ("renamed Chats→Peers on June 16"), not as *current truth* ("a Peer is an accepted connection"). Event logs only accumulate; they never get corrected, so they rot and contradict.
2. **Drift.** Four overlapping stores (`memory/*.md`, `CONTEXT.md`, `.dual-graph/context-store.json`, context-mode FTS5 KB) disagree. The *auto-loaded* memory (`project_launch_strategy.md`) is the **stale** one — it says nav is "Feed·People·Pings·Chats" while reality is Discover/Peers. The freshest truth is in the files that do NOT auto-load.
3. **All-or-nothing loading.** There is no cheap "map first, drill down on demand" path, so learning anything means reading whole files.

## Inspiration: Open Knowledge Format (OKF v0.1)

Source: https://cloud.google.com/blog/products/data-analytics/how-the-open-knowledge-format-can-improve-data-sharing/

The current setup is already a *bespoke* OKF instance (the blog explicitly names the "AGENTS.md / CLAUDE.md family" and "repos full of index.md and log.md artifacts" as existing examples of the pattern). This design makes it standard-shaped and adopts the two conventions that directly solve the problem.

Conventions adopted:

| OKF convention | Why |
|---|---|
| Concept = one markdown file; path = identity | Each subsystem/term is independently loadable |
| Frontmatter field set: `type, title, description, tags, timestamp` | Small, queryable, standard, portable |
| Cross-links = a graph richer than the folder tree | Navigate relationships between concepts |
| `index.md` = progressive disclosure | Load a cheap map first; drill into detail on demand → **token win** |
| `log.md` = chronological history | Validates separating *state* from *history* |
| **Per-concept `timestamp`** | **Per-fact freshness** → surgical re-verification, anti-drift |

Deliberately **NOT** adopted (YAGNI — solo single-project repo, not a multi-org catalog): deep nested directory hierarchies, producer/consumer conformance machinery, and splitting individual glossary terms into their own files.

## Design

### Structure

The memory directory `C:\Users\Imart\.claude\projects\C--Users-Imart-Desktop-ideas-techDate\memory\` becomes an OKF-aligned bundle:

```
memory/
  MEMORY.md            # INDEX (progressive disclosure) — auto-loaded
  glossary.md          # vocabulary concept
  arch-auth.md         # per-area architecture concepts...
  arch-feed.md
  arch-matching.md
  arch-peers.md        # connections: Ping → Peer
  arch-notifications.md
  arch-streaks.md
  arch-xp.md
  arch-gideon.md
  arch-database.md
  # existing concepts retained, frontmatter aligned to OKF:
  project_techdate.md
  user_profile.md
  feedback_tech.md
  project_launch_strategy.md
```

(Area list is provisional — finalized against current code during seeding. One area file per real subsystem; flat, no nesting.)

### Concept file format

```markdown
---
type: architecture        # architecture | glossary | project | user | feedback | reference
title: Peers & Connections
description: Ping → accept → Peer; messaging per match
tags: [peers, connections, matching]
timestamp: 2026-06-17T00:00:00Z
---

Current-state body, present tense. Cross-link concepts with
[glossary](glossary.md) / [matching](arch-matching.md) style links.
```

Rules:
- **Present tense, current truth only.** No dated event narration in concept bodies.
- **Overwritten in place** on change — never append-only.
- Body stays compact; detail that belongs in source code stays in source code (concept points to it).

### MEMORY.md as the index

Upgraded from a bare link list to a real progressive-disclosure index. For each concept: `name — one-line description — freshness`. Plus an **Open threads / next steps** section (absorbed from the retired `CONTEXT.md`). A fresh session reads this index first; it is usually enough to answer "what do the terms mean / what is the shape" without opening any concept file.

### State vs. history

| Store | Job | Shape | Loads at session start |
|---|---|---|---|
| `memory/` bundle (`MEMORY.md` + concepts) | **Current truth** + next steps | present-tense, overwritten | **Yes** (auto) |
| `.dual-graph/context-store.json` | **History / audit** (what happened, when, which files) | dated append log | No (on demand) |

- `context-store.json` is **kept** — different job, and mandated by the global `CLAUDE.md` dual-graph policy. It is the OKF `log`.
- `CONTEXT.md` is **retired** — fully absorbed (current state → concept files; next steps → MEMORY.md index).

### Update discipline

After each meaningful change (same trigger as the existing "after edits → `graph_register_edit` + append `context-store.json`" step in `CLAUDE.md`):
1. Overwrite the affected concept file's body with the new current truth.
2. Bump that concept's `timestamp`.
3. Update the concept's one-liner in `MEMORY.md` if its description changed.

This keeps freshness "after each change" (user's chosen cadence) and rides existing discipline, so it is not a new habit to remember.

### Freshness / anti-drift

Each concept's `timestamp` makes staleness per-fact. When a concept is older than the code it describes, re-verify *only that concept* against source, then overwrite + re-stamp. No more whole-file "2 days old" guessing.

## Seeding (first build)

Build the initial bundle by reconciling the existing stores **and verifying against current code** (memory is stale). Specifically:
- Extract current vocabulary + architecture from `CONTEXT.md`, `context-store.json`, and the existing memory files.
- **Verify each claim against current source** before writing it as truth (e.g. confirm nav tabs are Discover/Peers, not the stale "People/Chats").
- Fix the known drift in `project_launch_strategy.md` (nav naming) as part of seeding.
- Stamp every seeded concept with today's timestamp.

## Out of scope

- Changing the global `CLAUDE.md` dual-graph policy or the context-mode MCP setup.
- Hook-enforced updates (chosen cadence is "auto after each change", not hook-gated).
- Any application/runtime code change in the TechDate app itself.

## Success criteria

1. A fresh session, reading only `MEMORY.md`, can correctly state current vocabulary (Peer, Ping, Discover, Pings tab, Gideon, vestigial `dating_unlocked`) and the nav/architecture shape **without opening source files**.
2. No two stores contradict each other after seeding.
3. The freshest truth is what auto-loads (the index), not a stale file.
4. Per-concept timestamps allow identifying exactly which facts need re-verification.
```

