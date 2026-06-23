# Cross-Session Memory — OKF Bundle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restructure cross-session memory into an OKF-aligned bundle so a fresh session knows the codebase (vocabulary + architecture) from a cheap auto-loaded index, without re-reading source or the user re-explaining terms.

**Architecture:** The memory dir becomes an OKF bundle: `MEMORY.md` is a progressive-disclosure index; `glossary.md` + per-area `arch-*.md` files hold current truth (present-tense, overwritten, OKF frontmatter with per-concept `timestamp`); `.dual-graph/context-store.json` stays as the history log; `CONTEXT.md` is retired. Every concept fact is verified against current source before being written.

**Tech Stack:** Markdown + YAML frontmatter. No code/runtime. Verification by reading current source (`app/`, `lib/`, `supabase/migrations/`, `components/`).

## Global Constraints

- Memory dir path: `C:\Users\Imart\.claude\projects\C--Users-Imart-Desktop-ideas-techDate\memory\` — **NOT** part of the techDate git repo; concept files are not committed.
- Git-tracked files touched: `CONTEXT.md` (repo root, deleted), `docs/superpowers/...` (spec + this plan). Commit only when the user asks; if committing, branch off `master` first.
- OKF frontmatter field set is exactly: `type, title, description, tags, timestamp`. No other fields on concept files.
- `type` values: `architecture | glossary | project | user | feedback | reference`.
- Concept bodies are **present tense, current truth only** — no dated event narration, never append-only; overwrite in place.
- Every fact written as truth MUST be verified against current source first. Memory is known stale (e.g. `project_launch_strategy.md` says nav "Feed·People·Pings·Chats"; reality is Discover/Peers).
- `timestamp` value for all seeded concepts: `2026-06-17T00:00:00Z`.
- Do NOT modify the global `C:\Users\Imart\CLAUDE.md` dual-graph policy or context-mode MCP config.

---

### Task 1: OKF convention + glossary concept

**Files:**
- Create: `…\memory\glossary.md`
- Reference (read to verify): `components/layout/Navbar.tsx`, `app/(app)/discover/`, `app/(app)/matches/`, `app/(app)/requests/`, `lib/xp/award.ts`, `project_launch_strategy.md`

**Interfaces:**
- Produces: the OKF frontmatter convention (`type/title/description/tags/timestamp`) and `glossary.md`, cross-linked to by all later concept files via `[term](glossary.md)`.

- [ ] **Step 1: Verify current vocabulary against source**

Read `components/layout/Navbar.tsx` (confirm nav tab labels), `app/(app)/discover` + `matches` + `requests` (confirm route→concept mapping), `lib/xp/award.ts` (confirm `dating_unlocked` is vestigial). Record the *actual* terms.

Run: confirm nav labels and that `dating_unlocked` gates nothing.
Expected: nav is Discover/Peers (not People/Chats); `dating_unlocked` flipped but unused.

- [ ] **Step 2: Write `glossary.md`**

```markdown
---
type: glossary
title: Glossary
description: Project vocabulary — current meanings
tags: [glossary, vocabulary]
timestamp: 2026-06-17T00:00:00Z
---

# Glossary

- **Peer** — an accepted connection. See [peers](arch-peers.md).
- **Ping** — a pending connection request (swipe, direction right). See [peers](arch-peers.md).
- **Pings (tab)** — incoming requests awaiting accept (route `/requests`).
- **Discover** — the browse/SwipeDeck page for finding people (route `/discover`).
- **Gideon** — Python cron that ingests posts per genre. See [gideon](arch-gideon.md).
- **XP** — points earned per interaction. See [xp](arch-xp.md).
- **dating_unlocked** — vestigial users column; still flipped in awardXp, gates nothing.
- **Streak** — consecutive-day login count on IST boundary. See [streaks](arch-streaks.md).

<!-- Cross-linked targets may not all exist yet; created in Task 2. -->
```

(Replace any term above that Step 1 proves wrong with the verified value.)

- [ ] **Step 3: Verify**

Read `glossary.md` back. Confirm: frontmatter has exactly the 5 OKF fields; every term matches Step 1's verified value; no stale "People"/"Chats" labels.
Expected: PASS — all terms verified, no stale labels.

---

### Task 2: Per-area architecture concepts

**Files:**
- Create: `…\memory\arch-auth.md`, `arch-feed.md`, `arch-matching.md`, `arch-peers.md`, `arch-notifications.md`, `arch-streaks.md`, `arch-xp.md`, `arch-gideon.md`, `arch-database.md`
- Reference (read to verify each): `components/layout/SessionWatcher.tsx` + `lib/auth/`; `app/(app)/feed/` + `app/api/posts/`; `lib/matching/candidates.ts` + `app/api/swipes/route.ts`; `app/(app)/matches` + `requests` + `app/api/matches/`; `lib/notifications.ts` + `app/api/notifications/`; `lib/streak.ts` + `app/api/streak/route.ts`; `lib/xp/award.ts`; `gideon/`; `supabase/migrations/` (001–023).

**Interfaces:**
- Consumes: glossary cross-link target `glossary.md` (Task 1).
- Produces: nine `arch-*.md` concept files; their filenames are the link targets used by `MEMORY.md` (Task 3) and by glossary back-links.

- [ ] **Step 1: Verify each area against current source**

For each area, read the referenced files and note the *current* behavior (routes, data flow, key tables/functions). Do not carry over claims from existing memory without confirming in code.
Expected: a verified one-paragraph current-state summary per area.

- [ ] **Step 2: Write each area file using this template**

```markdown
---
type: architecture
title: <Area Title>
description: <one line, current state>
tags: [<area>, ...]
timestamp: 2026-06-17T00:00:00Z
---

# <Area Title>

<Present-tense current-state body. Routes, data flow, key tables/functions.
Point to source paths (e.g. `lib/matching/candidates.ts::scoreCandidate`)
rather than duplicating code. Cross-link related concepts:
[glossary](glossary.md), [peers](arch-peers.md).>
```

Concrete required content per file (verified values from Step 1):
- `arch-auth.md` — middleware redirects, `(auth)`/`(app)` route groups, SessionWatcher keep-alive, Supabase `(supabase as any).from` cast rule.
- `arch-feed.md` — feed page, posts/comments/likes, triggers, gideon posts (`is_gideon`).
- `arch-matching.md` — interest vectors, `scoreCandidate` weighting (60/20/20), candidate feed.
- `arch-peers.md` — Ping→accept→Peer flow; swipes/matches/requests tables; messaging per match; sorted-ID match key.
- `arch-notifications.md` — derived from posts; dismissals in `dismissed_notifications` (mig 022/023); the composite-FK PostgREST junction trap.
- `arch-streaks.md` — IST day boundary, `lib/streak.ts::effectiveStreak`, date-keyed client trigger.
- `arch-xp.md` — `awardXp` ledger + increment, weights, dating auto-unlock at 100 (now vestigial gate).
- `arch-gideon.md` — Python cron, HN/dev.to sources, dedupe by URL, `MAX_POSTS_PER_GENRE`, GitHub Actions schedule.
- `arch-database.md` — table inventory 001–023 with one-line purpose each; RLS note; anon-key client.

- [ ] **Step 3: Verify**

For each file: frontmatter has exactly the 5 OKF fields; body is present-tense; cross-links point to filenames that exist (glossary + other arch files).

Run: grep the memory dir for stale terms.
Expected: PASS — no occurrences of "Chats" or "People" as nav labels in concept bodies; every link target file exists.

---

### Task 3: Rebuild MEMORY.md as the index + retire CONTEXT.md

**Files:**
- Modify: `…\memory\MEMORY.md` (full rewrite)
- Delete: `C:\Users\Imart\Desktop\ideas\techDate\CONTEXT.md` (git-tracked)
- Reference (read to absorb next-steps): `CONTEXT.md`

**Interfaces:**
- Consumes: all concept filenames from Tasks 1–2 and existing memory files.
- Produces: the auto-loaded index — the single entry point a fresh session reads first.

- [ ] **Step 1: Read CONTEXT.md and extract its "Next Steps"**

Capture the next-steps / open-threads bullets verbatim for absorption.
Expected: list of open threads (verify-on-prod items, optional follow-ups).

- [ ] **Step 2: Rewrite MEMORY.md as the OKF index**

```markdown
# Memory Index

> OKF bundle. Read this index first. Drill into a concept file only when you
> need its detail. Each concept is present-tense current truth with a
> `timestamp` — re-verify against source if a concept looks older than the code.
> Maintenance: after each meaningful change, overwrite the affected concept
> file's body AND bump its `timestamp`; update its one-liner here if changed.
> History/audit lives in `.dual-graph/context-store.json` (the log), not here.

## Concepts

### Current truth
- [glossary](glossary.md) — project vocabulary (Peer, Ping, Discover, Gideon…) — 2026-06-17
- [arch-auth](arch-auth.md) — route groups, middleware, session keep-alive — 2026-06-17
- [arch-feed](arch-feed.md) — feed, posts/comments/likes, gideon posts — 2026-06-17
- [arch-matching](arch-matching.md) — interest vectors, candidate scoring — 2026-06-17
- [arch-peers](arch-peers.md) — Ping→Peer flow, swipes/matches/requests — 2026-06-17
- [arch-notifications](arch-notifications.md) — derived notifs, PostgREST junction trap — 2026-06-17
- [arch-streaks](arch-streaks.md) — IST boundary, effectiveStreak — 2026-06-17
- [arch-xp](arch-xp.md) — awardXp ledger, weights — 2026-06-17
- [arch-gideon](arch-gideon.md) — content cron, sources, dedupe — 2026-06-17
- [arch-database](arch-database.md) — tables 001–023, RLS — 2026-06-17

### Project / user / reference
- [project_techdate](project_techdate.md) — MVP status
- [project_launch_strategy](project_launch_strategy.md) — networking pivot (Ping→Chat)
- [user_profile](user_profile.md) — user background & collaboration prefs
- [feedback_tech](feedback_tech.md) — key technical decisions/patterns

## Open threads / next steps
<absorbed from CONTEXT.md Step 1 — verbatim bullets>
```

- [ ] **Step 3: Delete CONTEXT.md**

```bash
cd "C:/Users/Imart/Desktop/ideas/techDate"
git rm CONTEXT.md
```

- [ ] **Step 4: Verify**

Read MEMORY.md back. Confirm: every concept link resolves to an existing file; maintenance + log-location notes present; open-threads section non-empty; `CONTEXT.md` no longer exists.
Expected: PASS — index complete, CONTEXT.md gone, no next-step content lost.

---

### Task 4: Align existing memory files + fix drift

**Files:**
- Modify: `…\memory\project_launch_strategy.md`, `project_techdate.md`, `user_profile.md`, `feedback_tech.md`
- Reference: `components/layout/Navbar.tsx` (current nav truth)

**Interfaces:**
- Consumes: verified nav/vocabulary from Task 1.
- Produces: existing concepts conformed to OKF frontmatter and free of drift, so nothing auto-loaded contradicts the new concepts.

- [ ] **Step 1: Fix the known drift in project_launch_strategy.md**

Replace stale nav naming. The file currently says nav tabs are "Feed · People · Pings · Chats" and "Chats (was Matches)". Update to the verified current labels (Discover/Peers) or mark the historical naming explicitly as past with a pointer to [glossary](glossary.md) for current terms.

- [ ] **Step 2: Align frontmatter on all four files**

Ensure each has exactly the OKF fields `type, title, description, tags, timestamp`. Map existing `metadata.type` → top-level `type`; drop non-OKF fields (`node_type`, `originSessionId`) from the queryable set (may keep in body if useful). Set `timestamp: 2026-06-17T00:00:00Z`.

- [ ] **Step 3: Verify no contradictions across the bundle**

Run from the memory dir: search all `*.md` for stale nav labels and for term definitions that disagree with `glossary.md`.
Expected: PASS — no file claims "People"/"Chats" as current nav; all term definitions match glossary.

---

### Task 5: End-to-end acceptance check

**Files:**
- Reference only: entire `…\memory\` bundle

**Interfaces:**
- Consumes: Tasks 1–4 outputs.
- Produces: confirmation the success criteria hold.

- [ ] **Step 1: Cold-read simulation**

Using ONLY `MEMORY.md`, state: the four current nav tabs, what Peer/Ping/Discover mean, and that `dating_unlocked` is vestigial — without opening any source file.
Expected: all stated correctly from the index alone.

- [ ] **Step 2: Contradiction sweep**

Search the whole memory dir for stale terms and conflicting definitions; confirm `CONTEXT.md` is deleted and `context-store.json` still exists.
Expected: zero contradictions; state-vs-history split intact (bundle = truth, context-store.json = log).

- [ ] **Step 3: Freshness check**

Confirm every concept file carries a `timestamp`.
Expected: PASS — per-concept freshness present.

- [ ] **Step 4 (optional, on user request): Commit git-tracked changes**

```bash
cd "C:/Users/Imart/Desktop/ideas/techDate"
git checkout -b chore/okf-memory
git add docs/superpowers/ ; git rm --cached CONTEXT.md
git commit -m "chore: OKF cross-session memory bundle + retire CONTEXT.md"
```

(Only if the user asks to commit. Concept files in `~/.claude` are not part of this repo and are not committed.)

---

## Self-Review

**Spec coverage:**
- OKF bundle structure → Tasks 1–2 (glossary + per-area concepts). ✓
- MEMORY.md as progressive-disclosure index → Task 3. ✓
- Per-concept `timestamp` freshness → Tasks 1,2,4 (write) + Task 5 Step 3 (verify). ✓
- Keep context-store.json as log, retire CONTEXT.md → Task 3. ✓
- Seed by verifying against current code; fix stale drift → Tasks 1,2 Step 1 + Task 4 Step 1. ✓
- Update discipline documented → Task 3 Step 2 (maintenance note in index). ✓
- Success criteria (cold-read, no contradictions, freshest auto-loads, per-fact freshness) → Task 5. ✓

**Placeholder scan:** Concept *bodies* are seeded at execution from verified source (content specified per-file in Task 2 Step 2); no "TBD"/"handle edge cases" left. Template `<...>` markers are fill-from-verified-source instructions, not deferred work.

**Type/name consistency:** Concept filenames (`glossary.md`, `arch-auth.md` … `arch-database.md`) are identical in Tasks 2, 3, and the glossary links. `timestamp` value uniform (`2026-06-17T00:00:00Z`). OKF field set identical everywhere.
