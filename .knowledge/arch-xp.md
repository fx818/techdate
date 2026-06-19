---
type: architecture
title: XP System
description: awardXp ledger + weights; 100-XP dating unlock now vestigial
tags: [xp, gamification, ledger]
timestamp: 2026-06-18T00:00:00Z
---

# XP System

Experience points from interactions. There is **no standalone XP endpoint** — every interaction that earns XP calls `lib/xp/award.ts::awardXp(userId, action)` directly from the relevant API route (likes, comments, posts, streak).

- **awardXp** inserts an `xp_events` row (append-only ledger, `003_xp_events`), increments `users.xp`, and historically auto-unlocks dating at `xp >= 100`.
- **Weights:** `like=2, comment=10, reply=5, post=25, profile_complete=20, login_streak=3`.
- **dating_unlocked is vestigial:** still flipped at 100 XP for parity but gates nothing — the connection layer ([peers](arch-peers.md)) is core/on, not XP-gated. Candidate for removal.
- RPC form added in `021_award_xp_rpc`; match-count maintenance in `019_match_count`.
- Tests: `tests/lib/xp/`.
