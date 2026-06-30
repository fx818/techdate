---
type: architecture
title: Database
description: Supabase/Postgres, RLS, migrations 001–032, type-cast + PostgREST gotchas
tags: [database, supabase, postgres, rls, migrations, redis]
timestamp: 2026-06-30T18:00:00Z
---

# Database

Supabase Postgres. Migrations in `supabase/migrations/`, run in order, **001 → 032**. All tables have RLS enabled. App server routes use the **anon-key client (cookie auth)**, not the service role key. The **push send path** uses a separate service-role client (`lib/supabase/admin.ts`) to read other users' `device_tokens`.

## Core tables (origin migrations)
- `001_users` — profile, `interest_vector` (jsonb), `xp`, `dating_unlocked`, `is_premium`
- `002_posts_comments_likes` — counts auto-incremented by triggers
- `003_xp_events` — append-only XP ledger
- `004_swipes_matches` — swipes + matches, `unique(user1_id, user2_id)`
- `005_messages` — chat messages per match
- `006_matches_rls_insert` — INSERT policy required for match creation

Later migrations add: company email/verify (007), streak storage (008), requests model (010–011), bookmarks/images (013), notifications seen (014), blocks/reports (015), profile photos (017), usernames/slugs (020), award-xp RPC (021), dismissed notifications (022) + de-junction fix (023) — **dropped in 028**, **admin report triage (024)**, **admin metrics RPC (025)**, **device_tokens (026)**, lobsters source (027), **notifications table (028)**, new Gideon sources allowed (029).

- **024_admin_report_triage** — `users.is_admin` (bool, set manually), `reports.status` ('open'|'resolved'), `is_admin()` SECURITY DEFINER fn, RLS letting admins read/update all reports. **Applied to prod 2026-06-30** (was never applied until then — prod had lagged the repo here; see log). Founder account `admin@admin.com` seeded directly with `is_admin=true` (app signup can't create it — fake email fails verification). Password login needs an `auth.identities` row (email provider, `identity_data.sub`=uid) alongside `auth.users`, or GoTrue rejects the credentials.
- **025_admin_metrics** — `admin_metrics()` SECURITY DEFINER fn returning kill-test KPIs (signups, posters, repeat posters, 7d-active, pings, matches, rolling week-1→week-4 retention cohort) as JSON; admin-gated. Surfaced at `/admin/metrics` and `/admin/reports`. **Applied to prod 2026-06-30** (alongside 024). See [moderation](arch-moderation.md).
- **030_admin_metrics_engagement** — create-or-replace `admin_metrics()` adding engagement + composition keys (`active_today`, `messages_total`/`_7d`, `comments_total`/`_7d`, `likes_total`/`_7d`, `gideon_posts_total`); existing keys preserved (additive — page reads by key name). Same `is_admin()` gate + grant. **Applied to prod 2026-06-30.**
- **026_device_tokens** — `device_tokens(id uuid PK, user_id → users, token text, platform text default 'android', created_at)`, unique `(user_id, token)`, RLS own-rows-only, index on `user_id`. See [push](arch-push.md).
- **027_allow_lobsters_source** — widened `posts_source_check` to allow `'lobsters'` (was `hackernews|devto|xcom|user`). The Lobsters source was added to Gideon 2026-06-19 but the constraint was never updated, so every Gideon run **crashed** (postgrest 23514) the moment it tried to insert a Lobsters post. See [gideon](arch-gideon.md).
- **028_notifications** — added `notifications` table (stored event-sourced bell; single-column `id` PK to avoid the 023 two-FK junction trap; RLS select/update/delete-own, NO insert policy → inserts via service-role admin client) and **dropped `dismissed_notifications`** (obsolete; dismissal now sets `notifications.dismissed_at`). See [notifications](arch-notifications.md).
- **029_allow_new_gideon_sources** — widened `posts_source_check` again to add `'reddit'`, `'arxiv'`, `'github'` (full set now `hackernews|devto|xcom|user|lobsters|reddit|arxiv|github`). Same trap as 027: Gideon gained 3 sources 2026-06-30 but the constraint wasn't updated, so the first prod run **crashed** (23514) on the first GitHub insert. Applied to prod via the aws-1 pooler; re-run then inserted github/arxiv/devto/lobsters cleanly. See [gideon](arch-gideon.md).
- **031_gideon_judge_config** — `gideon_judge_config` singleton table (`id=1` CHECK, `enabled`, `api_key`, `base_url`, `model`, `criteria`, `pass_threshold 0–10`, RLS admin-only). Two SECURITY DEFINER RPCs: `gideon_judge_config_get()` returns masked JSON (`key_set`+`key_last4`, never raw key); `gideon_judge_config_save(p_enabled, p_base_url, p_model, p_criteria, p_threshold, p_api_key)` keeps existing key when `p_api_key=''`. Gideon reads the full row via service-role client (bypasses RLS). **Applied to prod 2026-06-30** via the aws-1 pooler (row seeded `enabled=false`; both RPCs present). See [gideon](arch-gideon.md), [moderation](arch-moderation.md).
- **032_gideon_reject_queue** — `gideon_rejections` (id uuid, `url` UNIQUE, title/content/image_url/genre/source, `score`, `reason`, created_at) + `gideon_dismissed_urls` (url PK tombstones). Both RLS admin-only SELECT; all mutations via SECURITY DEFINER RPCs. `gideon_approve_rejection(p_id)` inserts the reject into `posts` (generated unique slug, `is_gideon=true`) then deletes the row; `gideon_dismiss_rejection(p_id)` tombstones the URL then deletes the row. Gideon writes rejects + reads tombstones via the service-role client. See [gideon](arch-gideon.md), [moderation](arch-moderation.md).

## Gotchas (do not relearn the hard way)
- **Type-inference workaround:** `createServerClient<Database>` from `@supabase/ssr` does not propagate the generic through `.from()`. Every server-side query must use `(supabase as any).from(...)`. Intentional, project-wide — do not remove. Same applies to `createBrowserClient` in `lib/supabase/client.ts`.
- **PostgREST m2m trap:** never give a join table a composite PK of exactly two FKs — PostgREST treats it as an m2m junction and makes embeds ambiguous (this emptied the feed; fixed in 023). See [notifications](arch-notifications.md).
- **Next.js 16:** dynamic route `params` is `Promise<{id:string}>` — always `await params`.

## Redis (Upstash)
Daily swipe/Ping cap: key `swipes:{userId}:{YYYY-MM-DD}`, 86400s TTL (`lib/redis/`). A generic `rateLimit(action, userId, limit, windowSec)` (fixed-window, `rl:{action}:{userId}`, **degrades open** on Redis failure) throttles posts/comments/messages/reports. See [peers](arch-peers.md), [moderation](arch-moderation.md).
