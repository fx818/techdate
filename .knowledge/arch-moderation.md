---
type: architecture
title: Moderation & Admin
description: Blocks, reports, rate limits, and founder-only triage + kill-test + Gideon judge dashboards
tags: [moderation, safety, blocks, reports, admin, ratelimit, gideon]
timestamp: 2026-06-30T18:00:00Z
---

# Moderation & Admin

Safety surface for a solo-founder launch with live DMs. Block + report existed since `015_blocks_reports`; rate limits and founder triage were added 2026-06-19.

## Blocks & reports (users)
- **Blocks** (`blocks` table): `get_blocked_ids()` (SECURITY DEFINER) returns ids blocked in **either** direction; the [feed](arch-feed.md) and [Discover](arch-peers.md) exclude them. UI: `components/feed/PostSafetyMenu.tsx`, `components/messages/ChatHeaderMenu.tsx`, `components/profile/UserSafetyMenu.tsx`. API: `app/api/block/route.ts`.
- **Reports** (`reports` table): users file reports on a user/post/comment via `app/api/report/route.ts`. `reports.status` is 'open'|'resolved' (migration 024).

## Rate limits
`rateLimit(action, userId, limit, windowSec)` in `lib/redis/client.ts` — fixed-window Upstash counter (`rl:{action}:{userId}`), **degrades open** if Redis is down (never blocks a real user over infra). Applied: posts 10/h, comments 30/h, messages 30/min, reports 20/h. (Swipes/Pings keep their separate daily cap.)

## Admin (founder-only)
- Gated by `users.is_admin` (set manually in DB; migration 024) + `is_admin()` SQL fn; enforced by RLS and a page-level redirect (`!profile.is_admin` → `/feed`). Migrations 024+025 **applied to prod 2026-06-30**; founder account `admin@admin.com` seeded with `is_admin=true`.
- **Entry point:** profile page (`app/(app)/profile/page.tsx`) Admin section — Reports + Metrics + **Gideon judge** links, gated on `profile.is_admin`. No navbar entry.
- **`/admin/reports`** (`app/(app)/admin/reports/page.tsx`) — report queue; `ResolveReportButton` flips status via `PATCH /api/admin/reports/[id]`.
- **`/admin/metrics`** (`app/(app)/admin/metrics/page.tsx`) — kill-test dashboard from `admin_metrics()` RPC (migrations 025+030): two launch gates (≥20 repeat posters; ≥30% week-1→week-4 retention) + People/Content/Engagement/Network tiles. `RefreshButton` calls `router.refresh()`. See [database](arch-database.md).
- **`/admin/gideon`** (`app/(app)/admin/gideon/page.tsx`) — edit the Gideon LLM judge singleton (`gideon_judge_config`, migration 031). Loads config via `gideon_judge_config_get()` (masked — `key_set`+`key_last4` only, never raw key). Form at `components/admin/JudgeConfigForm.tsx` (client); saves via `POST /api/admin/judge` → `gideon_judge_config_save()` RPC. Body validated by `parseJudgeConfigInput` (`lib/admin/judgeConfig.ts`). Blank `api_key` = keep existing. API route has its own `getUser()` + `is_admin` check independent of the page gate. Also shows a "Rejected queue (N)" count link. See [gideon](arch-gideon.md).
- **`/admin/gideon/rejections`** (`app/(app)/admin/gideon/rejections/page.tsx`) — the judge's reject-review queue (`gideon_rejections`, migration 032). Lists drops newest-first with score + reason; `components/admin/RejectionActions.tsx` (client) **Approve**/**Delete** → `POST /api/admin/gideon/rejections/[id]` ({action} validated by `parseRejectionAction`, `lib/admin/rejectionAction.ts`) → `gideon_approve_rejection` / `gideon_dismiss_rejection` RPC. Delete permanently tombstones the URL. See [gideon](arch-gideon.md), [database](arch-database.md).
