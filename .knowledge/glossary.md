---
type: glossary
title: Glossary
description: Project vocabulary and domain terms
tags: [glossary, vocabulary]
timestamp: 2026-06-18T00:00:00Z
---

# Glossary

Domain terms a fresh session must know to read this codebase. Present tense, current truth.

- **Ping** — a connection request. Implemented as a right-swipe row in the `swipes` table (direction `right`). Sent from Discover or any profile via `components/dating/PingButton.tsx`. No XP gate, no gender filter. See [peers](arch-peers.md).
- **Peer** — an *accepted* connection (a `matches` row). The **Peers** tab lists them (renamed from Matches/Chats). Each Peer has a 1:1 chat. See [peers](arch-peers.md).
- **Discover** — the nav tab + `/discover` route for browsing interest-matched people (renamed from "People"; earlier "Discover" referred to the swipe deck). Right-swipe = Ping. See [matching](arch-matching.md).
- **Pings / Requests** — incoming pending Pings, shown under the requests inbox (`/requests`). Accept → creates a `matches` row → a Peer. See [peers](arch-peers.md).
- **XP** — experience points earned from interactions; ledgered in `xp_events`. Historically 100 XP unlocked dating. See [xp](arch-xp.md).
- **dating_unlocked** — vestigial boolean on `users`. Still flipped in `awardXp` at 100 XP for parity, but gates nothing (the connection layer is core/on now). See [xp](arch-xp.md).
- **Gideon** — the Python cron agent that seeds discussion posts per genre. Posts carry `is_gideon=true`. See [gideon](arch-gideon.md).
- **interest_vector** — per-user `Record<string, number>` of genre weights, normalized to sum 1.0. Drives candidate ranking. See [matching](arch-matching.md).
- **Genre** — a tech topic category; seeds the interest vector at onboarding (`lib/genres.ts`).
