# Await — Product Roadmap

> Created 2026-06-19. Companion to `2026-06-15-mvp-launch-and-gtm-debate.md`.
> Turns the "MVP is built" state into a phased, prioritized path to a real product.
> Phases are sequenced by dependency, not preference: you cannot skip ahead without
> paying for it later. Each phase has a **gate** that must be true before the next starts.

## Where we are (ground truth)

- **Stack:** Next.js 16, Supabase (Postgres + RLS), Redis (swipe/rate counters). Deployed.
- **Built:** discussion feed (posts/comments/likes, trigger-maintained counts, saved posts,
  Gideon-seeded posts), Discover (interest_vector cosine ranking), Ping → accept → Peer + 1:1 chat,
  XP ledger, IST streaks, derived/dismissible notifications.
- **Direction (locked 2026-06-15):** verified-techie discussion community + lightweight networking.
  Not dating. Connection = Ping → accept → chat, open to all, no XP gate.
- **Named risks (from the debate memo):**
  1. Discussion cold-start — `Gideon MAX_POSTS_PER_GENRE` low + URL dedupe → static feed.
  2. "Verified techies" is a ~25-domain denylist with no MX/disposable check — claim is not real.
  3. DMs live day one, solo founder, no moderation team.

## Update — shipped 2026-06-19 (+ audit corrections)

Building Phase 1 surfaced that the codebase was **more complete than the memo claimed**. Audit corrections:
- **Verification is already real** — disposable check (`disposable-email-domains`, ~120k), MX check with A-record fallback (`lib/auth/mx.ts`), and a personal→company-email 7-day gate enforced in `proxy.ts` + layout. Risk #2 is largely resolved; the claim is justified.
- **Block + report already existed** (`015_blocks_reports`, safety menus on posts/chats/profiles). Risk #3 was partly mitigated.
- `middleware.ts` is actually **`proxy.ts`** (Next 16 rename) — CLAUDE.md is stale.

Shipped this session (Phase 0 + Phase 1):
- **Cold-start feed (1.1):** Gideon cap 2→5 (env `GIDEON_MAX_POSTS_PER_GENRE`), added Lobsters as a 3rd source, 12h→6h cadence, URL+title dedupe. Feed source default `community`→`all` so seeded content shows day one. `GettingStarted` first-run nudge.
- **Verification (1.2):** disposable emails now gated immediately (no 7-day trial).
- **Moderation (1.3):** generic `rateLimit()` on posts/comments/messages/reports; founder report triage (`/admin/reports`, mig 024 `is_admin` + `reports.status`).
- **Instrumentation (0):** kill-test dashboard `/admin/metrics` (mig 025 `admin_metrics()` RPC) — reuses existing tables, no new events table.
- **Cleanup:** deleted dead `MatchModal.tsx`; removed unused `dating_unlocked` selects.

**Manual step required:** set `users.is_admin = true` for the founder account in the DB before `/admin/*` works.

Still open: 1.4 onboarding deep-work, Phase 2 GTM/kill-test (execution), Phase 3 features.

---

## Phase 0 — Ground truth & instrumentation  ·  P0  ·  ~1 day

**Goal:** stop guessing. Confirm what is actually live, and make the kill-test *measurable*
before we change anything.

- [ ] Audit deployed state vs. `.knowledge/` — confirm feed, Discover, Ping/Peer, chat, streaks all work end-to-end on prod.
- [ ] Add minimal analytics events: signup, onboarding-complete, first-post, first-comment, first-ping, ping-accepted, daily-active. (Needed for Phase 2's go/no-go — without this the kill-test is unfalsifiable.)
- [ ] Define the cohort view: week-1 signups, and whether they're still posting week-4.

**Gate to Phase 1:** we can answer "how many real users acted today, and what did they do?"

---

## Phase 1 — Launch-blockers  ·  P0  ·  the make-or-break phase

These are the things that make a launch *fail*. Cheapest to fix, highest downside if skipped.
Ordered within the phase by importance.

### 1.1 Cold-start feed  ·  P0 (the #1 launch risk)
A techie who lands on a dead feed leaves and never comes back. The feed must feel alive on day one with zero friends.
- [ ] Raise Gideon depth/frequency; smarter dedupe (not just URL); diversify sources beyond HN + dev.to.
- [ ] Founder seed-content playbook: N posts/genre + seeded comments so threads look inhabited.
- [ ] "First 60 seconds": a brand-new user's feed is populated, relevant to their onboarding genres, and has an obvious thing to react to.
- [ ] Empty-state handling everywhere the feed/Discover could be sparse.

### 1.2 Identity / verification  ·  P0
Either make the "verified techie" claim real, or stop making it. A denylist isn't verification.
- [ ] Decide mechanism: MX + disposable-domain check (cheap) vs. GitHub/LinkedIn OAuth proof (stronger, better signal). Recommend OAuth-as-optional-badge + MX gate on email.
- [ ] Until real: remove/soften the "verified" marketing claim.

### 1.3 Safety / moderation  ·  P0
DMs are live with a solo founder. Request/accept gating + block/report exist, but the surface is real.
- [ ] Report queue the founder can actually triage (even a simple admin list).
- [ ] Enforce block (no chat, no profile, no ping). Rate-limit posts/comments/pings/messages.
- [ ] Basic content guardrails (length, link spam).

### 1.4 Onboarding → first action  ·  P1
Retention starts in the first session. Push the new user to post/comment/ping before they leave.
- [ ] Guided first action after onboarding (suggested post prompt, "ping 3 people like you").
- [ ] Reduce steps to first contribution.

**Gate to Phase 2:** a stranger can sign up, see a living feed, trust the space, and take a first action — and we can measure that they did.

---

## Phase 2 — GTM / kill-test  ·  P0 execution  ·  6–8 weeks

Mostly execution, not code. Only credible *after* Phase 1.
- [ ] Seed-content cadence (founder posts + replies daily for weeks).
- [ ] Recruit 20–50 real Bangalore techies (the debate's chosen beachhead).
- [ ] Run the kill-test, instrumented by Phase 0.

**Kill-test (from the debate memo) — go/no-go:**
- ≥ 20 real humans post *unprompted* more than once, AND
- ≥ 30% of week-1 signups still posting in week 4.

**Gate to Phase 3:** kill-test passes. If it fails, we fix the funnel or pivot — we do NOT build features on a dead community.

---

## Phase 3 — Differentiating features  ·  P1  ·  post-signal

Build only what Phase 2 learnings justify. Candidates, not commitments:
- [ ] Discovery search on `/discover` (already noted as a near-term want).
- [ ] Topics / groups / channels.
- [ ] Reputation (turn the XP ledger into visible signal that means something).
- [ ] Events / AMAs (techie-native gathering format).
- [ ] Richer profiles (work, projects, GitHub).

**Gate to Phase 4:** clear retention + organic growth signal.

---

## Phase 4 — Monetization  ·  P2  ·  after PMF signal

- [ ] Candidate models: premium (better discovery/reach), recruiter/hiring access, sponsored AMAs.
- [ ] Pick one that doesn't poison the community dynamic.

---

## Cleanup / debt to fold in opportunistically

- `users.dating_unlocked` is vestigial (flipped in `awardXp`, gates nothing) — candidate for removal.
- `components/dating/MatchModal.tsx` is dead code.
- `preference` column stored but unused since dating was dropped.

---

## How we execute this

Each phase item that touches code gets its own **spec → implementation plan → build** cycle.
Next step after this roadmap is approved: brainstorm **Phase 1.1 (cold-start feed)** into a real
design, since it's the highest-leverage launch-blocker and pure product work.
