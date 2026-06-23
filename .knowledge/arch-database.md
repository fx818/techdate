---
type: architecture
title: Database
description: Supabase/Postgres, RLS, migrations 001–026, type-cast + PostgREST gotchas
tags: [database, supabase, postgres, rls, migrations, redis]
timestamp: 2026-06-23T00:00:00Z
---

# Database

Supabase Postgres. Migrations in `supabase/migrations/`, run in order, **001 → 026**. All tables have RLS enabled. App server routes use the **anon-key client (cookie auth)**, not the service role key. The **push send path** uses a separate service-role client (`lib/supabase/admin.ts`) to read other users' `device_tokens`.

## Core tables (origin migrations)
- `001_users` — profile, `interest_vector` (jsonb), `xp`, `dating_unlocked`, `is_premium`
- `002_posts_comments_likes` — counts auto-incremented by triggers
- `003_xp_events` — append-only XP ledger
- `004_swipes_matches` — swipes + matches, `unique(user1_id, user2_id)`
- `005_messages` — chat messages per match
- `006_matches_rls_insert` — INSERT policy required for match creation

Later migrations add: company email/verify (007), streak storage (008), requests model (010–011), bookmarks/images (013), notifications seen (014), blocks/reports (015), profile photos (017), usernames/slugs (020), award-xp RPC (021), dismissed notifications (022) + de-junction fix (023), **admin report triage (024)**, **admin metrics RPC (025)**, **device_tokens (026)**.

- **024_admin_report_triage** — `users.is_admin` (bool, set manually), `reports.status` ('open'|'resolved'), `is_admin()` SECURITY DEFINER fn, RLS letting admins read/update all reports.
- **025_admin_metrics** — `admin_metrics()` SECURITY DEFINER fn returning kill-test KPIs (signups, posters, repeat posters, 7d-active, pings, matches, rolling week-1→week-4 retention cohort) as JSON; admin-gated. Surfaced at `/admin/metrics` and `/admin/reports`. See [moderation](arch-moderation.md).
- **026_device_tokens** — `device_tokens(id uuid PK, user_id → users, token text, platform text default 'android', created_at)`, unique `(user_id, token)`, RLS own-rows-only, index on `user_id`. See [push](arch-push.md).

## Gotchas (do not relearn the hard way)
- **Type-inference workaround:** `createServerClient<Database>` from `@supabase/ssr` does not propagate the generic through `.from()`. Every server-side query must use `(supabase as any).from(...)`. Intentional, project-wide — do not remove. Same applies to `createBrowserClient` in `lib/supabase/client.ts`.
- **PostgREST m2m trap:** never give a join table a composite PK of exactly two FKs — PostgREST treats it as an m2m junction and makes embeds ambiguous (this emptied the feed; fixed in 023). See [notifications](arch-notifications.md).
- **Next.js 16:** dynamic route `params` is `Promise<{id:string}>` — always `await params`.

## Redis (Upstash)
Daily swipe/Ping cap: key `swipes:{userId}:{YYYY-MM-DD}`, 86400s TTL (`lib/redis/`). A generic `rateLimit(action, userId, limit, windowSec)` (fixed-window, `rl:{action}:{userId}`, **degrades open** on Redis failure) throttles posts/comments/messages/reports. See [peers](arch-peers.md), [moderation](arch-moderation.md).
