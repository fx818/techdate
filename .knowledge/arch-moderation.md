---
type: architecture
title: Moderation & Admin
description: Blocks, reports, rate limits, and the founder-only triage + kill-test dashboards
tags: [moderation, safety, blocks, reports, admin, ratelimit]
timestamp: 2026-06-19T00:00:00Z
---

# Moderation & Admin

Safety surface for a solo-founder launch with live DMs. Block + report existed since `015_blocks_reports`; rate limits and founder triage were added 2026-06-19.

## Blocks & reports (users)
- **Blocks** (`blocks` table): `get_blocked_ids()` (SECURITY DEFINER) returns ids blocked in **either** direction; the [feed](arch-feed.md) and [Discover](arch-peers.md) exclude them. UI: `components/feed/PostSafetyMenu.tsx`, `components/messages/ChatHeaderMenu.tsx`, `components/profile/UserSafetyMenu.tsx`. API: `app/api/block/route.ts`.
- **Reports** (`reports` table): users file reports on a user/post/comment via `app/api/report/route.ts`. `reports.status` is 'open'|'resolved' (migration 024).

## Rate limits
`rateLimit(action, userId, limit, windowSec)` in `lib/redis/client.ts` — fixed-window Upstash counter (`rl:{action}:{userId}`), **degrades open** if Redis is down (never blocks a real user over infra). Applied: posts 10/h, comments 30/h, messages 30/min, reports 20/h. (Swipes/Pings keep their separate daily cap.)

## Admin (founder-only)
- Gated by `users.is_admin` (set manually in DB; migration 024) + `is_admin()` SQL fn; enforced by RLS and a page-level redirect.
- **`/admin/reports`** (`app/(app)/admin/reports/page.tsx`) — report queue, open first; `components/admin/ResolveReportButton.tsx` flips status via `PATCH /api/admin/reports/[id]`.
- **`/admin/metrics`** (`app/(app)/admin/metrics/page.tsx`) — kill-test dashboard from the `admin_metrics()` RPC (migration 025): the two launch gates (≥20 repeat posters; ≥30% week-1→week-4 retention) plus signup/active/post/ping counts. See [database](arch-database.md).
