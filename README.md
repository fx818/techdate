# Await

**Some connections are worth the await.**

Await is a hybrid **tech-discussion + dating** platform for tech professionals (built for Indian Tier‑1 cities). You join a discussion community, earn XP by participating, and once you cross a threshold the dating layer unlocks — so you meet people who've genuinely engaged with the same ideas you have.

🔗 **Live:** https://techdate-eta.vercel.app

---

## The core idea

```
Sign up → pick your interests → discuss tech (posts, comments, likes)
        → earn XP → unlock dating at 100 XP
        → send a request → they accept → chat
```

Two layers, one account:

- **Discussion layer (always free):** a feed of community posts + auto‑curated tech news, with likes, threaded comments, bookmarks, and search/filters.
- **Dating layer (unlocked at 100 XP):** an interest‑matched discovery deck with a request → accept → chat flow.

---

## Features

### 🔐 Authentication & accounts
- **Email + password** sign up / sign in (email confirmation required).
- **Company‑email verification with a 24‑hour trial** — anyone can start with a personal email (Gmail, Outlook, etc.), but after 24 hours a work‑email verification is required to continue. Users who sign up with a company email are exempt (never asked to verify); the verification step also rejects known free providers.
- **Forgot / reset password** flow via email recovery link.
- **Self‑service account deletion** — removes your profile, posts, comments, matches, and messages (DPDP/privacy friendly).

### 📰 Discussion feed
- **Post** text **and images** (uploaded to Supabase Storage), tagged by genre.
- **Auto‑curated content** from the Gideon agent (HackerNews + dev.to), badged as "Gideon".
- **Search** posts by title/content (debounced, live).
- **Filters** behind a single control: **Source** (All / Community / Gideon — *defaults to Community*), **Sort** (Latest / Most liked / Most discussed), **Topic** (your genres).
- **Post detail view** with the full post, image, and the complete comment thread.
- **Threaded comments & replies**, **likes**, and **bookmarks** ("Saved posts").
- **Edit / delete your own posts and comments.**
- **Floating compose button** + clean, card‑based feed.

### 🎮 XP & gamification
Every interaction earns XP; reaching **100 XP** unlocks dating.

| Action | XP |
|--------|----|
| Like a post | 2 |
| Reply to a comment | 5 |
| Comment on a post | 10 |
| Create a post | 25 |
| Complete your profile | 20 (one‑time) |
| Daily login streak | 3 / day |

XP and a 🔥 login streak are always visible in the header.

### 💛 Dating (Discover)
- **Interest‑matched discovery deck** ranked by an interest‑vector cosine similarity (60%) + XP‑tier proximity (20%) + activity recency (20%).
- Filtered by **city + your "Show me" preference** (Men / Women / Everyone — *dating only, never affects the feed*).
- Already‑matched, already‑swiped, and blocked users never reappear in the deck.
- The **"Show me"** preference (Men / Women / Everyone) applies **only to Discover** — never the feed.
- **Multiple profile photos** with a swipeable carousel.
- **"Active recently"** status on cards and profiles.
- **Match count** is public (shown on every profile); your matches list lets you open each person's profile or jump into chat.

### 🤝 Request / Accept matching
- A right‑swipe sends a **request** (no blind auto‑matching).
- A dedicated **Requests** page with **All / Received / Sent** tabs.
- Recipients **Accept** (creates the match + opens chat) or **Decline**; senders can **Withdraw** a pending request.
- Free users get **10 swipes/day** (rate‑limited via Redis); the limit degrades gracefully if Redis is unavailable.

### 💬 Messaging
- Per‑match chat with the other person's **profile photo** in the header.
- Polls for new messages; clay outgoing / paper incoming bubbles.

### 🔔 Notifications
- A **bell in the header** with an unread badge.
- Alerts you when **someone you've matched with posts** something; tap through to the post.

### 🛡️ Trust & safety
- **Block** a user (removes them from your feed, discover, notifications, and tears down any match).
- **Report** users, posts, or comments.
- **Unmatch** from the chat header.

### 👤 Profiles
- **Your profile:** identity card, a single row of 4 stat tiles (XP · Matches · Streak · Dating), interests, **your recent posts with "View all" → `/profile/posts`**, saved posts, edit (multi‑photo upload), sign out, delete account.
- **Public profiles** (`/users/[id]`): anyone's bio, interests, recent posts, and a matching 4‑stat row (XP · Matches · Streak · Posts); author names/avatars across the app link here.

---

## Tech stack

| Layer | Tech |
|-------|------|
| Framework | **Next.js 16** (App Router, Turbopack, React Server Components) |
| Language | TypeScript |
| Styling | **Tailwind CSS v4** — custom "warm paper" theme (clay accent, Fraunces + Hanken Grotesk) |
| Backend / DB / Auth / Storage | **Supabase** (PostgreSQL + Row‑Level Security) |
| Rate limiting | **Upstash Redis** (daily swipe counter) |
| Content agent | **Python** cron on **GitHub Actions** |
| Hosting | **Vercel** |

Everything runs on free tiers.

---

## Architecture

### Route groups
```
app/
  (auth)/          login, onboarding, reset-password   — no navbar, no auth guard
  (app)/           feed, discover, requests, matches, messages/[matchId],
                   profile, users/[id], posts/[id], saved, notifications, verify-company
                   └── layout.tsx — auth guard + 24-hour trial gate + global header + bottom nav
  auth/callback/   route handler for Supabase email links (confirm / recovery / email-change)
  api/             ~19 route handlers (see AGENT.md for the full list)
```

### Key data flows
- **XP:** interactions call `lib/xp/award.ts::awardXp`, which writes an `xp_events` row, increments `users.xp`, and auto‑unlocks dating at 100.
- **Interest vectors:** each user has a normalized `interest_vector` (sums to 1.0), seeded at onboarding and nudged on every like/comment/post; drives match ranking.
- **Request/accept:** right‑swipes are pending requests; a `SECURITY DEFINER` SQL function surfaces incoming/sent requests without leaking swipe data; accepting creates the match.
- **Notifications & blocking:** derived on read from matches/posts and a `get_blocked_ids()` `SECURITY DEFINER` helper (no extra tables/cron).

### Project layout
```
app/                Next.js routes (pages + API)
components/         feed, dating, messages, profile, layout, ui
lib/                supabase clients, xp, matching, auth, redis, time, notifications, genres
supabase/migrations/  ordered SQL migrations (001–019)
gideon/             Python content agent + genre config
proxy.ts            Next.js 16 middleware (auth redirects, x-pathname header)
```

---

## Getting started

**Prerequisites:** Node 18+, a Supabase project, an Upstash Redis database.

```bash
# 1. Install
npm install

# 2. Configure env (see below)
cp .env.example .env.local   # then fill in values

# 3. Apply database migrations
npx supabase db push         # or run supabase/migrations/*.sql in order

# 4. Run
npm run dev                  # http://localhost:3000
```

Other commands:
```bash
npm run build     # production build
npm run lint      # ESLint
npm run test      # Vitest unit tests (lib/)
npx vitest run tests/lib/matching/vector.test.ts   # a single test file
```

### Environment variables
| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Service role key (used by the Gideon agent) |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token |
| `NEXT_PUBLIC_APP_URL` | App URL (e.g. `https://your-app.vercel.app`) |

> ⚠️ When setting these on Vercel, avoid piping values through shells that re‑encode stdin — a stray BOM/whitespace will silently break the Supabase/Redis clients. The code now defensively trims Redis env vars, but set values cleanly.

### Supabase dashboard config
- **Auth → Providers → Email:** enabled.
- **Auth → URL Configuration → Redirect URLs:** add `https://<your-app>/auth/callback` (required for signup, password recovery, and company‑email verification).
- **Storage buckets:** `avatars` and `post-images` (created by migrations 008 & 013).

---

## Database

19 ordered migrations in `supabase/migrations/`. Run them in order (`npx supabase db push`).

| # | Migration | Adds |
|---|-----------|------|
| 001 | users | profile, interest_vector, xp, dating_unlocked |
| 002 | posts_comments_likes | posts/comments/likes + count triggers |
| 003 | xp_events | append‑only XP ledger |
| 004 | swipes_matches | swipes + matches (unique sorted pair) |
| 005 | messages | chat per match |
| 006 | matches_rls_insert | match INSERT policy |
| 007 | company_email | company_email + verified flag |
| 008 | profile_streak_storage | streak columns + `avatars` bucket |
| 009 | fix_counts_and_match | `SECURITY DEFINER` count triggers + mutual‑swipe fn |
| 010 | requests_model | incoming‑requests fn (request/accept) |
| 011 | sent_requests | sent‑requests fn |
| 012 | swipe_delete_policy | allow withdrawing a swipe |
| 013 | images_bookmarks | post `image_url`, `bookmarks` table, `post-images` bucket |
| 014 | notifications_seen | `last_notifications_seen` |
| 015 | blocks_reports | `blocks` + `reports` tables, `get_blocked_ids()` |
| 016 | content_ownership | edit/delete RLS + `delete_own_account()` |
| 017 | profile_photos | `users.photos` array |
| 018 | account_deletion_posts | delete posts on account deletion |
| 019 | match_count | public `match_count(user)` function |

> **RLS note:** every server query uses `(supabase as any).from(...)` — an intentional workaround because `@supabase/ssr`'s typed client doesn't propagate generics through `.from()`. Cross‑user gates that RLS can't express use `SECURITY DEFINER` functions.

---

## Gideon — the content agent

`gideon/` is a Python cron (no user account) that keeps the feed fresh so it's never empty.

- Runs **every 12 hours** via GitHub Actions (`.github/workflows/gideon.yml`), or on demand (`workflow_dispatch`).
- Fetches from **HackerNews Algolia API** + **dev.to API** per genre, dedupes by URL, and inserts the **2 highest‑scoring posts per genre** (`is_gideon = true`).
- Writes with the service‑role key (bypasses RLS).

**GitHub Actions secrets required:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Deploy to Vercel

1. Push to GitHub.
2. Import the project in Vercel — **Framework Preset must be "Next.js"** (a `vercel.json` pins this).
3. Add all environment variables (set them cleanly — see the warning above).
4. Add the Supabase redirect URL and create the storage buckets (above).
5. Deploy.

---

For deeper implementation context (conventions, full route/migration map, gotchas), see **[AGENT.md](./AGENT.md)**.
