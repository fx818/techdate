# AGENT.md — TechDate Context

Quick-start context for any AI agent working on this codebase.

## What this app is

TechDate is a hybrid tech-discussion + dating platform for Indian tech professionals (Tier 1 cities). Users earn XP through tech content interactions; at 100 XP, a dating/swipe feature unlocks.

**Live URL:** https://techdate-eta.vercel.app  
**GitHub:** https://github.com/fx818/techdate  
**Supabase project:** `ynfkwndtmoajcmjppftp` (ap-south-1, Mumbai)

---

## Critical patterns — never change these

### `(supabase as any).from(...)`
Every server-side Supabase table query uses this cast. `createServerClient<Database>` from `@supabase/ssr` does NOT propagate generics through `.from()`. This is intentional. Do not remove.

### Next.js 16 middleware = `proxy.ts`
Next.js 16 renamed `middleware.ts` → `proxy.ts`. The proxy function must be named `proxy` (not `middleware`). Adding a `middleware.ts` alongside it will cause a build error.

### `await params` everywhere
Dynamic routes use `Promise<{id: string}>` for params in Next.js 16. All dynamic handlers already do `const { id } = await params`. Follow this for any new dynamic route.

---

## Auth flow

```
Sign up → email confirmation → /auth/callback → /onboarding → /feed
Sign in → /feed (or /onboarding if no profile)
```

- **Login:** email + password only (no phone OTP)
- **Company email enforcement:** users with personal email (gmail, yahoo, etc.) have a 7-day trial. After that, `app/(app)/layout.tsx` redirects to `/verify-company`.
- **Company email verification:** `supabase.auth.updateUser({ email })` → Supabase sends confirmation → `/auth/callback?type=email_change` → sets `company_email_verified = true` in users table.
- **Supabase redirect URL** (must be set in dashboard): `https://techdate-eta.vercel.app/auth/callback`

### Personal email domains (`lib/auth/email.ts`)
`isPersonalEmail(email)` checks against: gmail.com, yahoo.com, hotmail.com, outlook.com, live.com, rediffmail.com, protonmail.com, icloud.com, me.com, aol.com (and Indian variants).

---

## XP system

| Action | XP |
|--------|-----|
| like | 2 |
| comment | 10 |
| reply | 5 |
| post | 25 |
| profile_complete | 20 |
| login_streak | 3 |

`DATING_UNLOCK_THRESHOLD = 100`

All XP is awarded via `POST /api/xp` with `{ action: XpAction }`, which calls `lib/xp/award.ts::awardXp`. This also auto-sets `dating_unlocked = true` when XP crosses 100.

---

## Swipe / Match system

- Daily swipe limit: 10 (free), unlimited (premium)
- Redis key: `swipes:{userId}:{YYYY-MM-DD}` with 86400s TTL
- Match IDs use sorted user IDs: `[u1, u2].sort()` to satisfy unique constraint
- Race condition handled: on duplicate insert error, fetch the existing match

---

## Interest vectors

`users.interest_vector: Record<string, number>` — always sums to 1.0. Seeded at onboarding from genre picks (`lib/matching/vector.ts::seedVector`). Updated on every like/comment/post via `updateVector` + `normalizeVector`. Candidate feed uses cosine similarity: 60% sim + 20% XP tier proximity + 20% activity recency.

---

## Route groups

```
app/
  (auth)/         /login, /onboarding  — no navbar, no auth guard
  (app)/          /feed, /discover, /matches, /messages/[matchId], /profile, /verify-company
                  └── layout.tsx: auth guard + company email check + Navbar
  auth/callback/  route handler for Supabase email confirmation links
```

---

## Database (7 migrations in `supabase/migrations/`)

| Migration | What it does |
|-----------|-------------|
| 001_users | users table with RLS |
| 002_posts_comments_likes | posts, comments, likes with auto-increment triggers |
| 003_xp_events | append-only XP ledger |
| 004_swipes_matches | swipes + matches with unique(user1_id, user2_id) |
| 005_messages | chat per match |
| 006_matches_rls_insert | INSERT policy for matches (required for match creation) |
| 007_company_email | adds company_email + company_email_verified to users |

---

## API routes

| Route | Method | Auth | What it does |
|-------|--------|------|-------------|
| `/api/xp` | POST | required | Awards XP for an action |
| `/api/posts` | GET/POST | required | Feed posts |
| `/api/posts/[id]/like` | POST | required | Toggle like |
| `/api/posts/[id]/comments` | GET/POST | required | Comments |
| `/api/swipes` | POST | required | Swipe left/right, detect match |
| `/api/candidates` | GET | required | Ranked dating candidates |
| `/api/messages` | GET/POST | required | Chat messages |

---

## Gideon content agent

Python cron at `gideon/`, runs every 4h via GitHub Actions (`.github/workflows/gideon.yml`). Fetches HN Algolia + dev.to per genre, inserts up to 6 posts/genre with `is_gideon=true`. Secrets needed: `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.

---

## Infrastructure (all free tier)

| Service | What for |
|---------|---------|
| Vercel | Next.js hosting |
| Supabase | PostgreSQL + Auth + RLS |
| Upstash Redis | Daily swipe counter |
| GitHub Actions | Gideon cron |
