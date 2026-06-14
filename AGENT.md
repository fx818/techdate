# AGENT.md — Await Context

Quick-start context for any AI agent working on this codebase. (App was renamed from "TechDate" → **Await**; infra names like the repo/URL/Supabase project are still `techdate`.)

## What this app is

Await is a hybrid tech-discussion + dating platform for Indian Tier‑1 tech professionals. Users earn XP through discussion (posts, comments, likes); at 100 XP the dating layer unlocks (request → accept → chat).

**Live URL:** https://techdate-eta.vercel.app
**GitHub:** https://github.com/fx818/techdate
**Supabase project:** `ynfkwndtmoajcmjppftp` (ap-south-1, Mumbai)

---

## Critical patterns — never change these

- **`(supabase as any).from(...)`** — every server-side Supabase table query uses this cast. `createServerClient<Database>` from `@supabase/ssr` does NOT propagate generics through `.from()`. Intentional. Don't remove.
- **Next.js 16 middleware = `proxy.ts`** (not `middleware.ts`). The exported function is `proxy`. Adding a `middleware.ts` alongside it is a build error. `proxy.ts` also sets an `x-pathname` request header consumed by `(app)/layout.tsx`.
- **`await params`** — dynamic route params are `Promise<…>` in Next 16. Always `const { id } = await params`.
- **Framework preset** — Vercel must treat this as Next.js; `vercel.json` pins `"framework": "nextjs"` (without it, every route 404s).
- **Env hygiene** — values set via shells that re-encode stdin can carry a BOM and silently break the Supabase/Redis clients. `lib/redis/client.ts` defensively trims its env vars.
- **Cross-user gates** that RLS can't express use `SECURITY DEFINER` SQL functions (pattern: `has_right_swipe`, `get_incoming_requests`, `get_sent_requests`, `get_blocked_ids`, `delete_own_account`).

---

## Design system ("warm paper")

Tailwind v4 (CSS-config in `app/globals.css`, no `tailwind.config`). Tokens: `paper`/`surface` (cream), `ink`/`ink-soft`/`ink-faint` (warm near-black), `clay`/`clay-deep`/`clay-tint` (coral accent), `sage` (success), `line` (borders). Fonts: **Fraunces** (display, `font-display`) + **Hanken Grotesk** (UI) + Geist Mono. Shared primitives: `.card`, `.btn`/`.btn-primary`/`.btn-ghost`, `.input`, `.chip`, `animate-rise`/`animate-pop`.

**Shell:** global `Header` (Await wordmark + XP/streak pill + notification bell + profile avatar) → sticky control bar where relevant (feed search, requests tabs) → content; bottom `Navbar` has 4 tabs (Feed · Discover · Requests · Matches); profile is the header avatar; compose is a FAB on the feed.

---

## Auth flow

```
Sign up → email confirm → /auth/callback → /onboarding → /feed
Sign in → /feed (or /onboarding if no profile)
Forgot password → resetPasswordForEmail → /auth/callback?type=recovery → /reset-password
```
- Email + password only (no phone OTP).
- **7-day trial gate:** personal-email users (see `lib/auth/email.ts::isPersonalEmail`) are redirected to `/verify-company` after 7 days until they verify a work email (`updateUser({email})` → `/auth/callback?type=email_change` → sets `company_email_verified`).
- **Account deletion:** `/api/account` DELETE → `delete_own_account()` RPC (deletes the user's posts, then the auth user; cascades the rest) → signs out.
- Supabase dashboard **Redirect URLs** must include `https://techdate-eta.vercel.app/auth/callback`.

---

## XP system

`like=2, reply=5, comment=10, post=25, profile_complete=20, login_streak=3`. `DATING_UNLOCK_THRESHOLD=100`. Awarded via `lib/xp/award.ts::awardXp` (writes `xp_events`, increments `users.xp`, auto-unlocks dating). Login streak: idempotent per-day via `/api/streak` (pinged by `components/layout/StreakPing.tsx`, which also bumps `last_active`).

---

## Dating: matching, requests, swipes

- **Discover deck** (`app/(app)/discover/page.tsx`): candidates filtered by city + `preference` ("Show me", dating-only — never the feed), excluding self + already-swiped + matched + blocked + incoming-requesters. Ranked by `lib/matching/candidates.ts` (cosine 60% + XP tier 20% + recency 20%).
- **Pure request/accept model:** a right-swipe = a pending request (NO auto-match). `/api/swipes` only records the swipe. `/api/requests` GET lists received + sent (via `get_incoming_requests` / `get_sent_requests` RPCs); POST handles `accept` (creates match), `decline`, `withdraw` (deletes the swipe). Requests page has All/Received/Sent tabs.
- **Swipe limit:** 10/day free, Redis key `swipes:{userId}:{YYYY-MM-DD}` (86400s TTL); degrades open if Redis fails.
- **Matches:** unique sorted pair `[u1,u2].sort()`; created only on accept.
- **Multiple photos:** `users.photos text[]` (photo_url mirrors photos[0]); carousel in `ProfileCard`.

---

## Interest vectors

`users.interest_vector: Record<string, number>` normalized to 1.0. Seeded at onboarding (`lib/matching/vector.ts::seedVector`), nudged on like/comment/post.

---

## Trust & safety

- `blocks` (bidirectional via `get_blocked_ids()`) — blocked users hidden from feed, discover, notifications, profiles; blocking also tears down any match.
- `reports` on `user | post | comment`.
- Unmatch via `/api/matches/[id]` DELETE.
- UI: `components/ui/ActionMenu.tsx` overflow menu; `ChatHeaderMenu`, `PostSafetyMenu`, `UserSafetyMenu`, `PostOwnerMenu`.

---

## Notifications

Header bell (`NotifBell`) → `/api/notifications` (unread count). `/notifications` page lists posts by users you've matched with (`lib/notifications.ts::getNotifications`, derived on read, excludes blocked). Opening it POSTs `/api/notifications/seen` (sets `last_notifications_seen`).

---

## Posts, comments, bookmarks

- Posts: text + optional `image_url` (Storage bucket `post-images`), genre, `is_gideon`. Feed defaults to **Community** source; supports search (`title/content ilike`, sanitized), source/sort/genre filters.
- Post detail `/posts/[id]`: full content + image + full comment thread.
- Threaded comments (`parent_id`) with replies + delete-own; like + bookmark; edit/delete own posts.
- Bookmarks → `/saved`. Author links → `/users/[id]` (public profile).
- Like/comment counts kept correct by `SECURITY DEFINER` triggers (migration 009).

---

## Database (18 migrations in `supabase/migrations/`, run in order)

001 users · 002 posts/comments/likes (+count triggers) · 003 xp_events · 004 swipes/matches · 005 messages · 006 matches INSERT RLS · 007 company_email · 008 streak cols + `avatars` bucket · 009 SECURITY DEFINER count triggers + `has_right_swipe` · 010 `get_incoming_requests` · 011 `get_sent_requests` · 012 swipe DELETE policy · 013 post `image_url` + `bookmarks` + `post-images` bucket · 014 `last_notifications_seen` · 015 `blocks` + `reports` + `get_blocked_ids` · 016 post/comment edit-delete RLS + matches DELETE RLS + `delete_own_account` · 017 `users.photos` · 018 delete posts on account deletion.

Storage buckets: `avatars`, `post-images` (public read, owner-scoped write).

---

## API routes (`app/api/*`, all require auth unless noted)

| Route | Methods | Purpose |
|-------|---------|---------|
| `/api/xp` | POST | award XP |
| `/api/streak` | POST | daily login-streak (idempotent) |
| `/api/active` | POST | bump `last_active` |
| `/api/posts` | GET/POST | list / create posts (POST accepts `image_url`) |
| `/api/posts/[id]` | PATCH/DELETE | edit / delete own post |
| `/api/posts/[id]/like` | POST | toggle like |
| `/api/posts/[id]/bookmark` | POST | toggle bookmark |
| `/api/posts/[id]/comments` | GET/POST | list (all, incl replies) / create comment (`parent_id` → reply XP) |
| `/api/posts/[id]/comments/[commentId]` | DELETE | delete own comment |
| `/api/swipes` | POST | record a swipe (request; no auto-match) |
| `/api/requests` | GET/POST | list received+sent / accept·decline·withdraw |
| `/api/matches/[id]` | DELETE | unmatch |
| `/api/candidates` | GET | ranked dating candidates |
| `/api/messages` | GET/POST | chat messages |
| `/api/notifications` | GET | matched-users' posts + unread count |
| `/api/notifications/seen` | POST | mark notifications seen |
| `/api/block` | POST/DELETE | block / unblock (block tears down match) |
| `/api/report` | POST | report user/post/comment |
| `/api/account` | DELETE | delete own account |

---

## Gideon content agent

Python cron at `gideon/`, GitHub Actions (`.github/workflows/gideon.yml`), **every 12h** + `workflow_dispatch`. Fetches HN Algolia + dev.to per genre (config `gideon/genres.json`), dedupes by URL, inserts the **2 best (by HN points) posts/genre** with `is_gideon=true`. Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. (`requirements.txt` pins must keep `supabase`/`httpx`/`gotrue` mutually compatible — `supabase>=2.7` + `httpx>=0.26`.)

---

## Commands

`npm run dev` · `npm run build` · `npm run lint` · `npm run test` · `npx vitest run tests/lib/matching/vector.test.ts`. Verify changes with `npx tsc --noEmit` + `npm run build`; apply migrations with `npx supabase db push`; deploy with `npx vercel deploy --prod`.

---

## Infrastructure (all free tier)

Vercel (hosting) · Supabase (Postgres + Auth + RLS + Storage) · Upstash Redis (swipe counter) · GitHub Actions (Gideon cron).
