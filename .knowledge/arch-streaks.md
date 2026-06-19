---
type: architecture
title: Streaks
description: IST day boundary; date-keyed client trigger; effectiveStreak reads 0 when stale
tags: [streak, ist, login]
timestamp: 2026-06-18T00:00:00Z
---

# Streaks

Login-streak tracking. Logic in `lib/streak.ts`; API `app/api/streak/route.ts`; client trigger `components/layout/StreakPing.tsx`.

- **Day boundary is IST** (not UTC), so streaks count reliably for the India-based user base.
- **Client trigger is date-keyed:** `StreakPing` re-fires across day boundaries (keyed by the current IST date), so a streak ping happens once per IST day even on a long-lived tab.
- **effectiveStreak / live-correct display:** `lib/streak.ts` reports `0` when the last login is older than yesterday (IST) — a broken streak reads as 0 *before* the next visit, instead of showing a stale count.
- Streak storage: migration `008_profile_streak_storage`. A streak visit awards XP (`login_streak`) — see [xp](arch-xp.md).
