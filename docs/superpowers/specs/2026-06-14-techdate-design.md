# TechDate — Product Design Spec
**Date:** 2026-06-14
**Status:** Draft — pending implementation plan

---

## 1. Overview

TechDate is a hybrid discussion + dating platform exclusively for tech professionals. Users engage with tech content (discussions, posts, Gideon-curated news) and earn XP through activity. Once they cross an XP threshold, the dating layer unlocks — showing them swipeable profiles of other tech professionals whose interests align with theirs.

**Primary market:** Tier 1 Indian cities — Bangalore, Delhi/NCR (Noida, Gurgaon), Mumbai, Pune, Hyderabad.
**Target users:** Software engineers, developers, designers, PMs, data scientists, founders — anyone working in tech.
**Monetization:** Freemium (limited free swipes → paid subscription). Events in future.

---

## 2. Core Product Loop

```
Sign up → Pick genres → Browse feed (Gideon + user posts) → Earn XP → Unlock dating → Swipe → Match → Message
```

Two layers:

### Discussion Layer (always free)
- User picks 3–5 genres on signup: AI, LLMs, DevOps, Web Dev, Mobile, Cloud, Cybersecurity, etc.
- Feed shows content filtered by their genres — mix of Gideon-curated posts and user posts
- Every interaction earns XP (see weights below)
- Users can post their own content, comment, reply, like

### Dating Layer (unlocks at 100 XP)
- Tinder-style swipe deck — profiles filtered by city + genre overlap
- 10 free swipes/day; unlimited with premium
- Profile auto-built from discussion activity (genres, most active topics, recent posts)
- Algorithm evolves with behavior

### XP Weights
| Action | XP |
|---|---|
| Like a post | 2 |
| Reply to a comment | 5 |
| Comment on a post | 10 |
| Create a post | 25 |
| Profile completion (one-time) | 20 |
| Daily login streak (per day) | 3 |

Threshold to unlock dating: **100 XP** (roughly 4–5 active days).

---

## 3. Gideon Agent

Gideon is a background cron service — not a user account. It feeds the platform with fresh content per genre so the feed is never empty, especially on day one.

### How it works
- Runs every 4–6 hours via GitHub Actions scheduled workflow
- Fetches posts from:
  - **HackerNews API** (free, no limits) — primary source
  - **dev.to API** (free) — secondary source
  - **X.com API free tier** (1500 reads/month) — supplemental
- Filters: minimum engagement threshold, no spam, tech-relevant only
- Posts appear in feed with a **"Gideon"** label (small badge) + link back to source

### Genre routing
- Each genre maps to a set of keywords/tags used to query APIs
- E.g., "AI" genre → HN posts tagged `ai`, `machine-learning`, `llm`, `openai`
- Low-activity genres get more Gideon posts; high-activity genres get fewer

### Cadence
- Max 5–8 Gideon posts per genre per fetch cycle
- Deduplication check before inserting (skip if URL already exists)

---

## 4. Matching Algorithm

A hybrid approach: **Phase 1 as hard filters** (narrow the candidate pool) + **Phase 2 as smart ranking** (order within that pool). Both run from day one.

### Step 1 — Hard Filters (Phase 1)
Eliminate incompatible profiles before any scoring:
- Same city (required)
- Gender/preference match (required)
- XP tier proximity — only show profiles within ±1 tier (avoid dead accounts)

Reduces 10,000 users to ~200 realistic candidates.

### Step 2 — Interest Vector Matching (Phase 2)
Each user has an **interest vector** — a weighted map of genres derived from their activity:

```
new user (signup):   { AI: 0.5, DevOps: 0.5 }
after 1 week:        { AI: 0.8, DevOps: 0.12, WebDev: 0.08 }
```

**How the vector is built:**
- Seeded at signup from chosen genres (equal weight)
- Updated on every interaction: like/comment/post increments that genre's weight
- Re-normalised after each update so weights always sum to 1.0
- Stored as JSON in user profile in Supabase

**Ranking formula:**
```
final_score = (cosine_similarity × 0.6) + (xp_tier_proximity × 0.2) + (activity_recency × 0.2)
```

- `cosine_similarity` — dot product of two users' interest vectors (0 to 1)
- `xp_tier_proximity` — how close they are in activity level (1 = same tier)
- `activity_recency` — how recently they were active (decays over time, avoids stale profiles)

Top N scored candidates become the daily swipe deck.

### Cold Start Handling
New users with no interaction history default to genre selections as the seed vector — the system behaves like simple genre overlap matching on day 1, then gets smarter automatically as interactions accumulate. No manual phase transition needed.

### Future — Social Proof Boost (when data exists)
Once enough swipe data accumulates:
- Profiles with high right-swipe rates get a subtle score boost
- Profiles generating active discussion get surfaced higher
- Collaborative filtering layer added: "users like you also liked..."

### Dating Profile Card shows:
- Name, photo, city
- Tech genres (selected on signup)
- XP level (shown as tier: Explorer / Builder / Architect / Principal)
- "Most active in: [topic]" — auto-derived
- Optional: recent posts/comments (user can hide this)

---

## 5. Monetization

### Free Tier
- Full discussion access (unlimited)
- 10 swipes/day
- 3 messages per match

### Premium — ₹299/month or ₹799/quarter
- Unlimited swipes
- Unlimited messaging
- See who liked you
- 1 profile boost/week (appear higher in decks for 24hrs)
- Daily "Top Gideon" digest — best posts across all genres

### Revenue projections (conservative)
| Users | Conversion | MRR |
|---|---|---|
| 1,000 active | 1% → 10 paying | ₹3,000 |
| 5,000 active | 2% → 100 paying | ₹30,000 |
| 20,000 active | 3% → 600 paying | ₹1,80,000 |

### Future — Events (Month 6+)
- IRL genre meetups per city ("AI Night — Bangalore")
- ₹299–799 ticket price
- Platform takes 20% cut
- Acts as organic marketing + community building

---

## 6. Tech Stack (Zero-Cost MVP)

| Layer | Tool | Cost |
|---|---|---|
| Frontend | Next.js on Vercel | Free |
| Backend + DB + Auth | Supabase | Free (500MB DB, 1GB storage) |
| Cache | Upstash Redis | Free (10k commands/day) |
| Gideon cron | GitHub Actions | Free (2000 min/month) |
| Content sources | HackerNews API + dev.to API | Free |
| Phone OTP auth | Supabase Auth | Free |
| Profile photos | Supabase Storage | Free (1GB) |

**Total monthly cost: ₹0** until ~10k active users.

### Migration path
- When Supabase free tier limits hit: upgrade to Supabase Pro ($25/month)
- When Gideon needs more data: add X.com Basic API ($100/month) or Apify scraper
- Mobile app: React Native + Expo after web MVP validates core loop

---

## 7. Key Risks & Mitigations

| Risk | Mitigation |
|---|---|
| Cold start (no users, dead feed) | Gideon ensures feed is always populated from day 1 |
| X.com API costs | Start with HackerNews + dev.to (both free); X.com is supplemental |
| Dating stigma ("just a tech Tinder") | Market as discussion platform; dating is a reward, not the headline |
| Fake profiles / non-tech users | LinkedIn OAuth for signup verifies professional background |
| Low conversion to paid | Keep free tier genuinely useful; gate power features not core ones |

---

## 8. Out of Scope (v1)

- Mobile app (web-first, mobile later)
- AI-generated match explanations
- Video/voice calls
- In-app payments (link to Razorpay externally for now)
- Multi-language support

---

## 9. Success Metrics (3-month targets)

- 500 registered users across 2 cities
- 60% DAU/MAU ratio (discussion layer driving retention)
- 30% of registered users unlock dating (reach 100 XP)
- 10 paying premium subscribers
- Avg session length > 5 minutes
