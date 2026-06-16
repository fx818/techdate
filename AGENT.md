# AGENT.md — Await Context

Quick-start context for any AI agent working on this codebase. (App was renamed from "TechDate" → **Await**; infra names like the repo/URL/Supabase project are still `techdate`.)

## What this app is

Await is a hybrid tech-discussion + professional-networking platform for Indian Tier‑1 tech professionals. Users discuss tech (posts, comments, likes, earning XP) and connect via a **Ping → Chat** model: Ping someone → they accept → chat. The earlier romantic-dating framing was dropped — there is no gender/preference matching and no XP gate on connecting; messaging is open to all signed-up users. (See `docs/strategy/2026-06-15-mvp-launch-and-gtm-debate.md` for the rationale.)

**Naming note:** internal route paths and DB tables keep their original dating-era names — `/discover` (the Discover page), `/requests` (Pings), `/matches` (Peers), the `swipes` table (a right "swipe" = a Ping), and the `matches` table (an accepted connection). Only user-facing labels/copy were reframed. `users.dating_unlocked` and `users.preference` are vestigial (still written, gate nothing). `components/dating/MatchModal.tsx` is dead code.

**Public post pages:** `/posts/<slug>` is publicly viewable (logged-out = read-only thread + join CTA; like/save/comment need login). Allowed by `proxy.ts` (adds `/posts` to the public allow-list) + `(app)/layout.tsx` (renders a lightweight `PublicHeader` shell for logged-out visitors on `/posts`, else redirects). `/users/<username>` is deliberately NOT public (profile privacy for the future matchmaking pivot). Guest-aware bits: `PostActions` (isAuthed → read-only + login CTA), `CommentSection` (isAuthed → comments read-only, compose becomes a login CTA).

**URL slugs (migration 020):** page URLs are human-readable, never raw UUIDs — `/users/<username>`, `/posts/<slug>`, `/messages/<other-handle>-<matchId>`. UUIDs stay the PKs and appear only in the DB + `/api/*` routes. Helpers in `lib/slug.ts` (`slugify`, `isUuid`, `isValidUsername`, `userHref`/`postHref`/`chatHref`, `matchIdFromSlug`). Each dynamic page resolves by slug/username (or the trailing uuid for chats) and **falls back to a legacy UUID lookup that redirects to the canonical slug**. `[id]`/`[matchId]` folder names are kept; the segment value is the slug. `users.username` (unique, `^[a-z0-9_]{2,30}$`) is set at onboarding + editable in `EditProfile`; `posts.slug` (unique) is generated from the title on create (`/api/posts` POST and `gideon/fetch.py`), suffixed on clash. Any query feeding a profile/post link must select `username`/`slug`.

**Live URL:** https://techdate-eta.vercel.app
**GitHub:** https://github.com/fx818/techdate
**Supabase project:** `ynfkwndtmoajcmjppftp` (ap-south-1, Mumbai)

---

## Critical patterns — never change these

- **`(supabase as any).from(...)`** — every server-side Supabase table query uses this cast. `createServerClient<Database>` from `@supabase/ssr` does NOT propagate generics through `.from()`. Intentional. Don't remove.
- **Next.js 16 middleware = `proxy.ts`** (not `middleware.ts`). The exported function is `proxy`. Adding a `middleware.ts` alongside it is a build error. `proxy.ts` also sets an `x-pathname` request header consumed by `(app)/layout.tsx`.
- **`await params`** — dynamic route params are `Promise<…>` in Next 16. Always `const { id } = await params`.
- **Framework preset** — Vercel must treat this as Next.js; `vercel.json` pins `"framework": "nextjs"` (without it, every route 404s).
- **Region** — `vercel.json` pins `"regions": ["bom1"]` (Mumbai) to colocate functions with the Supabase DB (`ap-south-1`). Do NOT remove — functions in a US region make every query a ~250ms cross-planet round-trip (the app was unusably slow until this was set).
- **Env hygiene** — values set via shells that re-encode stdin can carry a BOM and silently break the Supabase/Redis clients. `lib/redis/client.ts` defensively trims its env vars.
- **Cross-user gates** that RLS can't express use `SECURITY DEFINER` SQL functions (pattern: `has_right_swipe`, `get_incoming_requests`, `get_sent_requests`, `get_blocked_ids`, `delete_own_account`, `match_count`).
- **Never give a join/link table a composite PK that is exactly two FKs to existing tables** — PostgREST reads `(a_id, b_id)`-as-PK with FKs to both `a` and `b` as a many-to-many *junction* and auto-infers an `a ↔ b` relationship. That makes any **direct** embed between those tables (e.g. `posts.select('*, users(...)')` via `author_id`) ambiguous, and PostgREST then returns `null` for the whole query — which surfaced once as an app-wide empty feed + missing notifications (migration 022 → fixed in 023). Give such tables a **surrogate `id` primary key** (like `likes`/`bookmarks`) and enforce uniqueness with a separate `unique(a_id, b_id)` constraint. If you must keep a composite PK, disambiguate every affected embed with an FK hint, e.g. `users!posts_author_id_fkey(...)`.

---

## Design system ("warm paper")

Tailwind v4 (CSS-config in `app/globals.css`, no `tailwind.config`). Tokens: `paper`/`surface` (cream), `ink`/`ink-soft`/`ink-faint` (warm near-black), `clay`/`clay-deep`/`clay-tint` (coral accent), `sage` (success), `line` (borders). Fonts: **Fraunces** (display, `font-display`) + **Hanken Grotesk** (UI) + Geist Mono. Shared primitives: `.card`, `.btn`/`.btn-primary`/`.btn-ghost`, `.input`, `.chip`, `animate-rise`/`animate-pop`.

**Shell:** global `Header` (Await wordmark + XP/streak pill + notification bell + profile avatar) → sticky control bar where relevant (feed search, Pings tabs) → content; bottom `Navbar` has 4 tabs (Feed · **Discover** · **Pings** · **Peers**, mapping to `/feed` · `/discover` · `/requests` · `/matches`); profile is the header avatar; compose is a FAB on the feed.

**Profiles:** `/profile` (own) and `/users/[id]` (public) share a layout: identity card + stat tiles + interests + recent posts. Own profile: 3 tiles (XP/💬 Chats/Streak). Public profile: 4 tiles (XP/Chats/Streak/Posts) + a `PingButton` (`components/dating/PingButton.tsx`) whose state is computed server-side — `none` (Ping to chat) / `pinged` (Ping sent) / `incoming` (Accept ping & chat) / `connected` (Message). Own profile previews 2 posts with "View all" → `/profile/posts`; saved posts at `/saved`.

---

## Auth flow

```
Sign up → email confirm → /auth/callback → /onboarding → /feed
Sign in → /feed (or /onboarding if no profile)
Forgot password → resetPasswordForEmail → /auth/callback?type=recovery → /reset-password
```
- Email + password only (no phone OTP).
- **7-day trial gate** (`lib/auth/email.ts::isTrialExpired`, `TRIAL_MS = 7 days`): personal-email **and** disposable-email users (`isPersonalEmail` + `lib/auth/disposable.ts::isDisposableEmail`) must verify a work email after 7 days. Enforced in **`proxy.ts` middleware** (runs on every request, incl. RSC nav — can't be soft-nav-bypassed): a trial-expired unverified user may only reach `/profile` + `/verify-company`; everything else redirects to `/verify-company`. The `(app)/layout` gate is defense-in-depth and also covers disposable emails. Company-domain signups are exempt. Verification is server-side via `POST /api/verify-company` (runtime nodejs): rejects personal providers, disposable/temp domains (~120k-domain blocklist from the `disposable-email-domains` pkg), and domains without MX/A records (`lib/auth/mx.ts::domainHasMx`); then `updateUser({email})` → `/auth/callback?type=email_change` → sets `company_email_verified`. The verify-company page is just UI that POSTs to the route. **Caveat:** this proves *inbox ownership at a non-free, non-disposable, mail-capable domain* — NOT actual employment (a cheap custom domain still passes), so don't over-claim "verified at a real company".
- **Account deletion:** `/api/account` DELETE → `delete_own_account()` RPC (deletes the user's posts, then the auth user; cascades the rest) → signs out.
- Supabase dashboard **Redirect URLs** must include `https://techdate-eta.vercel.app/auth/callback`.

---

## XP system

`like=2, reply=5, comment=10, post=25, profile_complete=20, login_streak=3`. Awarded via `lib/xp/award.ts::awardXp`, which calls the atomic `award_xp(p_action, p_xp)` RPC (migration 021 — one round-trip: insert `xp_events` + bump `users.xp` + flip `dating_unlocked`, all on `auth.uid()`). In the like/comment/post routes, XP + interest-vector updates run via Next's `after()` (post-response) so the interaction returns instantly; pass the request's supabase client into `awardXp(..., client)` inside `after()`. XP is a discussion reputation signal only — it does **not** gate connecting/messaging. (`DATING_UNLOCK_THRESHOLD=100` and the `dating_unlocked` flip still exist but gate nothing.) Login streak: idempotent per-day via `/api/streak` (pinged by `components/layout/StreakPing.tsx`, which also bumps `last_active`).

---

## Networking: Discover, Pings, Peers (Ping → accept → chat)

Open to all signed-up users — no XP gate, no gender/preference filter.

- **Discover deck** (`app/(app)/discover/page.tsx`): candidates in the same `city`, excluding self + already-pinged/skipped + connected + blocked + people who pinged you. Ranked by `lib/matching/candidates.ts` (cosine 60% + XP tier 20% + recency 20%). The `SwipeDeck` UI reframes right-swipe as **Ping**, left as **Skip**.
- **Two ways to Ping:** the Discover deck, or the `PingButton` on any `/users/[id]` profile.
- **Ping → accept model:** a right-swipe (`/api/swipes`) = a pending **Ping** (NO auto-connect). `/api/requests` GET lists received + sent (via `get_incoming_requests` / `get_sent_requests` RPCs); POST handles `accept` (creates the match/connection + chat), `decline`, `withdraw` (deletes the swipe). **Pings** page has All/Received/Sent tabs.
- **Peer count is public:** `match_count(p_user)` SECURITY DEFINER fn (count only, never who) — shown as "👥 Peers" on `/profile` and `/users/[id]`. The **Peers** list (`/matches`) links each row to the person's profile + a message button (`/messages/[matchId]`).
- **Ping limit:** 10/day free, Redis key `swipes:{userId}:{YYYY-MM-DD}` (86400s TTL); degrades open if Redis fails.
- **Connections:** `matches` table, unique sorted pair `[u1,u2].sort()`; created only on accept.
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

Header bell (`NotifBell`) → `/api/notifications` (unread count). `/notifications` page lists posts by users you're connected with (`lib/notifications.ts::getNotifications`, derived on read from `matches`, excludes blocked). Opening it POSTs `/api/notifications/seen` (sets `last_notifications_seen`).

---

## Posts, comments, bookmarks

- Posts: text + optional `image_url` (Storage bucket `post-images`), genre, `is_gideon`. Feed defaults to **Community** source; supports search (`title/content ilike`, sanitized), source/sort/genre filters.
- Post detail `/posts/[id]`: full content + image + full comment thread.
- Threaded comments (`parent_id`) with replies + delete-own; like + bookmark; edit/delete own posts.
- Bookmarks → `/saved`. Author links → `/users/[id]` (public profile).
- Like/comment counts kept correct by `SECURITY DEFINER` triggers (migration 009).

---

## Database (20 migrations in `supabase/migrations/`, run in order)

001 users · 002 posts/comments/likes (+count triggers) · 003 xp_events · 004 swipes/matches · 005 messages · 006 matches INSERT RLS · 007 company_email · 008 streak cols + `avatars` bucket · 009 SECURITY DEFINER count triggers + `has_right_swipe` · 010 `get_incoming_requests` · 011 `get_sent_requests` · 012 swipe DELETE policy · 013 post `image_url` + `bookmarks` + `post-images` bucket · 014 `last_notifications_seen` · 015 `blocks` + `reports` + `get_blocked_ids` · 016 post/comment edit-delete RLS + matches DELETE RLS + `delete_own_account` · 017 `users.photos` · 018 delete posts on account deletion · 019 public `match_count(user)` fn · 020 `users.username` + `posts.slug` (unique, NOT NULL, backfilled) for readable URLs · 021 atomic `award_xp(p_action, p_xp)` RPC (SECURITY DEFINER, uses auth.uid()).

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
| `/api/swipes` | POST | record a Ping (no auto-connect) |
| `/api/requests` | GET/POST | list received+sent pings / accept·decline·withdraw |
| `/api/matches/[id]` | DELETE | disconnect (remove a chat connection) |
| `/api/candidates` | GET | ranked Discover candidates |
| `/api/messages` | GET/POST | chat messages |
| `/api/notifications` | GET | matched-users' posts + unread count |
| `/api/notifications/seen` | POST | mark notifications seen |
| `/api/block` | POST/DELETE | block / unblock (block tears down match) |
| `/api/report` | POST | report user/post/comment |
| `/api/account` | DELETE | delete own account |

---

## Gideon content agent

Python cron at `gideon/`, GitHub Actions (`.github/workflows/gideon.yml`), **every 12h** + `workflow_dispatch` (with an opt-in `reset` input → `GIDEON_RESET` deletes all Gideon posts before fetching; scheduled runs never reset/prune — they only insert). Fetches HN Algolia (stories from the **last 7 days** only, for freshness) + dev.to per genre (config `gideon/genres.json`), dedupes by URL, inserts the **2 best (by HN points) posts/genre** with `is_gideon=true`. Each insert sets `slug`, `content` (dev.to `description` / HN `story_text` or a metadata blurb) and `image_url` (dev.to `cover_image`/`social_image`; HN has none) — so Gideon posts render like human posts, not bare title+link. Secrets: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. (`requirements.txt` pins must keep `supabase`/`httpx`/`gotrue` mutually compatible — `supabase>=2.7` + `httpx>=0.26`.)

---

## Commands

`npm run dev` · `npm run build` · `npm run lint` · `npm run test` · `npx vitest run tests/lib/matching/vector.test.ts`. Verify changes with `npx tsc --noEmit` + `npm run build`; apply migrations with `npx supabase db push`; deploy with `npx vercel deploy --prod`.

---

## Infrastructure (all free tier)

Vercel (hosting) · Supabase (Postgres + Auth + RLS + Storage) · Upstash Redis (daily ping counter) · GitHub Actions (Gideon cron).
