# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # start dev server
npm run build        # production build
npm run lint         # ESLint
npm run test         # run all tests (Vitest)
npm run test:watch   # watch mode

# Run a single test file
npx vitest run tests/lib/matching/vector.test.ts
```

Tests use Vitest + jsdom + @testing-library/jest-dom. Setup file at `tests/setup.ts`. All tests live under `tests/lib/`.

## Supabase Type Inference Workaround

**`createServerClient<Database>` from `@supabase/ssr` does not propagate the generic type through `.from()`.**
Every server-side Supabase query must use `(supabase as any).from(...)`. This is intentional and project-wide — do not remove these casts. The `createBrowserClient` in `lib/supabase/client.ts` has the same limitation.

## Architecture

### Route Groups

```
app/
  (auth)/       login, onboarding — no navbar, no auth guard
  (app)/        feed, discover, matches, messages/[matchId], profile
                └── layout.tsx  ← auth guard + bottom Navbar for all (app) routes
```

`middleware.ts` handles two redirects: unauthenticated users hitting non-auth routes → `/login`; authenticated users at `/` → `/feed`. The middleware matcher **excludes `api` routes** — API routes do their own `getUser()` checks.

### Data Flow: XP System

Every interaction that earns XP calls `lib/xp/award.ts::awardXp(userId, action)` directly from the relevant API route (likes, comments, posts). There is no standalone XP endpoint. `awardXp` inserts an `xp_events` row, increments `users.xp`, and auto-unlocks dating when `xp >= 100`.

XP weights: `like=2, comment=10, reply=5, post=25, profile_complete=20, login_streak=3`

### Data Flow: Interest Vectors

Each user has an `interest_vector: Record<string, number>` in their `users` row. It's seeded at onboarding from genre choices (`lib/matching/vector.ts::seedVector`) and updated on every like/comment/post via `updateVector` then `normalizeVector` (always sums to 1.0). The swipe candidate feed ranks profiles using cosine similarity weighted 60% sim + 20% XP tier proximity + 20% activity recency (`lib/matching/candidates.ts::scoreCandidate`).

### Data Flow: Swipes & Matches

`app/api/swipes/route.ts` checks the Redis daily counter (key: `swipes:{userId}:{YYYY-MM-DD}`, 86400s TTL), inserts the swipe, then checks for a mutual right-swipe. Match IDs use sorted user IDs (`[u1, u2].sort()`) to satisfy the unique constraint. On race condition (duplicate insert), the route falls back to fetching the existing match.

### Gideon Agent

Python cron at `gideon/` runs via GitHub Actions (`.github/workflows/gideon.yml`) every 6 hours. Fetches from 6 sources per genre — HN Algolia API, dev.to API, Lobsters (`gideon/sources/lobsters.py`), Reddit (`gideon/sources/reddit.py`, app-only OAuth via `oauth.reddit.com` per subreddit — the public `.json` host 403-blocks datacenter IPs), arXiv (`gideon/sources/arxiv.py`, newest papers, AI-ish genres only), and GitHub (`gideon/sources/github.py`, repo search by topic). Each source fails safe (returns `[]` on error). Posts are ranked by `merge_normalized` (per-source 0–1 score so big-number sources like GitHub/Reddit don't drown out arXiv), deduplicated by URL + normalized title, then up to `GIDEON_MAX_POSTS_PER_GENRE` (default 5) inserted with `is_gideon=true`. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions secrets; Reddit needs `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (free "script" app — without them the Reddit source no-ops); `GITHUB_TOKEN` (auto-provided by Actions) raises the GitHub search rate limit.

### Database Schema

8 tables in `supabase/migrations/` (run in order):
- `001_users` — profile, interest_vector (jsonb), xp, dating_unlocked, is_premium
- `002_posts_comments_likes` — posts with likes_count/comments_count auto-incremented by triggers
- `003_xp_events` — append-only ledger
- `004_swipes_matches` — swipes + matches with unique(user1_id, user2_id)
- `005_messages` — chat messages per match
- `006_matches_rls_insert` — INSERT policy for matches table (required for match creation)

All tables have RLS enabled. Server routes use the anon-key client (cookie auth), not the service role key.

### Shared Types

`lib/supabase/types.ts` — `Database` interface, plus `InterestVector`, `XpAction`, `Gender`, `Preference`, `SwipeDirection`, `PostSource`. `types/dating.ts` — `DatingProfile` shared between ProfileCard and SwipeDeck.

## Next.js Version Note

This project uses Next.js 16 with breaking changes from the version in your training data. Dynamic route `params` is `Promise<{id: string}>` — always `await params` in route handlers and page components.
