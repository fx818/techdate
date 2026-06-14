# Await — MVP launch readiness & go-to-market (multi-agent debate)

> Generated 2026-06-15 from a 12-agent debate: 5-lens panel (bull / bear / competitive-genre / growth-GTM / two-sided-market economist) → cross-rebuttal round → red-team attack on the consensus → synthesis. Agents read the actual codebase, not just the pitch.

---

## The verdict

**Launch in ~7-10 days — but launch ONLY the verified-techie discussion community, in ONE city (Bangalore), with the dating layer hard-disabled behind a feature flag.**

Not "launch the dating app with conditions." The conditions the optimists list (women-first seeding) *are the entire unsolvable business*, smuggled in as a checkbox. So: **sequence in time, not in channel.** The code already gates everything on `dating_unlocked` — you simply never grant it yet. Cost: zero (free tier). What it buys: you isolate the *one* load-bearing question every other argument is downstream of — **will Indian Tier-1 techies actually post and argue on a verified feed with no dating carrot?**

---

## Why "launch both now" is incoherent (the red-team's kill shot)

The panel's first-round consensus — *"launch both, but women-first AND community-first simultaneously"* — eats itself. Lay the four "settled" fixes side by side:

- **"Lead with community, hide dating"** + **"seed women first"** → community-first recruiting channels (dev Reddit, X, Peerlist) are ~90% male. Community-first *manufactures* the skew women-first is meant to prevent. You can't run both pitches at once.
- **"Drop the XP gate to 20"** + **"community must be sticky enough to retain men through thin dating liquidity"** → the XP gate is the *only* thing forcing the discussion that makes the community sticky. Slash it and it's a swipe app with an RSS reader bolted on.
- **"Company-email = the moat/trust badge"** + **"women in Indian tech won't attach a work email to an unknown dating app"** → the headline feature actively repels the one demographic that decides survival.

## The most likely way you die in 30 days — and it's NOT the gender ratio

Everyone chants "gender-ratio death spiral." That's too *slow* at N=0→100 — a spiral needs a population to spiral. The real first killer is the **community cold-start**:

1. ~40 founders sign up out of goodwill.
2. Feed shows stale HN/dev.to *links* with no human comments.
3. Posting into an empty room is socially expensive → people read, don't post.
4. No posting → no XP → nothing unlocks → no one ever sees a deck.
5. By week 3 you're replying to yourself. DAU → single digits.

**Gideon solves the empty *shelf*, not the empty *conversation*** — and discussion-FIRST is the whole thesis.

---

## Real defects the agents found in YOUR code (verify these)

| Claim in docs/marketing | What the code actually does | File |
|---|---|---|
| Gideon inserts "6 posts/genre" / "2 best" | `MAX_POSTS_PER_GENRE = 2`, **dedupes by URL** → after first runs, ~0 net-new inserts. Feed is a static link wall. | `gideon/fetch.py` |
| "Verified techies only, no fakes" | A **~25-domain personal-email denylist**. ANY custom domain (₹200 Namecheap, dead startup's GSuite) is auto-trusted as a "company email" — **zero MX/disposable check** + a **24h pre-verification trial** where an unverified account can like/comment/match. | `lib/auth/email.ts` |
| "XP-tier band filters the deck tightly" | Band is actually **wide** (~50–700 at 100 XP). The real cut is **city + gender**, not band width. | `app/api/candidates/route.ts` |
| Match count is a neutral public stat | In a male-skewed cohort it **broadcasts that men have zero matches** → accelerates churn. | shipped feature |

**Highest-leverage warning:** publicly marketing "verified techies only" while shipping fake verification is the single most likely public-embarrassment event — *"This 'verified techies only' dating app let me in with a fake company in 60 seconds"* is a Reddit post waiting to happen. Stop marketing the claim until MX + disposable-domain + tech-company allowlist exists.

---

## Launch blockers (do before opening doors)

1. **Hard-disable the dating layer** behind a flag — confirm no production path sets `dating_unlocked = true`. This is the keystone.
2. **Stop marketing "verified / no fakes"** immediately. Reframe as an opt-in "verified techie" *badge*; add disposable-domain/MX check before any verification copy ships.
3. **Fix Gideon** so the feed *changes*: raise `MAX_POSTS_PER_GENRE`, rotate sources / widen query window so each run surfaces net-new items.
4. **Seed 20-30 opinionated posts yourself** and commit to replying as founder to every comment for 6-8 weeks. Be the first/loudest voice or no one posts.
5. **Add a visible "message the founder" channel** (WhatsApp/Telegram/in-app) on the profile — your first cohort is your product team.
6. **Soft-fail the email gate** to "contact founder" instead of hard-blocking legit users at unlisted domains.

## Defer (only relevant once dating turns on)

- Lower/dynamic XP unlock — and only at the moment dating flips on; keep it **permanently low for the scarce side**, never ratchet it *up* on loyal early users (bait-and-switch → churn).
- Rework **request/accept + 10-swipes/day** — in a skewed pool it dumps 100% of curation labor on the few women as a pending-request queue (they feel besieged, not courted). Give the scarce side Bumble-style control. *This is the most dangerous retention mechanic in the build.*
- Hide/rework public match-count for dating.
- Referral loop; monetization — **build neither yet.**

---

## Go-to-market sequence

### Stage 1 — First 100 (weeks 1-8): prove the community retains, dating OFF
**Goal:** answer the one load-bearing question via a single falsifiable kill-test.
- Hand-recruit 40-60 people in **Bangalore only** — no Google Form, no pan-India blast. DM real engineers; pitch "verified-techie discussion feed, no recruiters, no bots." No dating mention.
- Send traffic to the **live app** (showing seeded + Gideon discussion), **not a Google Form** (Forms leak 40-60% of intent).
- Founder seeds posts + replies to every comment daily.
- Build-in-public on r/developersIndia, Indian-tech X, Peerlist, r/SideProject.
- Instrument the kill-test daily.

### Stage 2 — First 1000 (only if kill-test passes): manage ratio, then flip dating on in ONE city
- With a real, screenshot-able community in hand, recruit women in tech **honestly** (Women Who Code BLR, AnitaB/LeanIn India) — pitch the *community*, not "be supply for my dating app." **Proof precedes scarce-side recruitment.**
- **Permanently waive the XP gate for women;** verify them via LinkedIn/Peerlist — **never force a work email** (career/harassment asymmetry).
- Flip dating ON in Bangalore only when the city hits ~50+ verified members with a **deliberately balanced ratio** — gate on **scarce-side density (women active)**, never raw headcount.
- Use a **private** unlock threshold, never a public "73/100" countdown (a stalled bar is anti-social-proof / a tombstone).

### Stage 3 — Beyond: city-by-city, and the pivot option
- Open the next city only after Bangalore shows live dating liquidity AND a non-collapsing ratio. Never run six cities thin.
- Product Hunt = first-1000 amplifier with testimonials, never a zero-liquidity launch.
- **Seriously consider the reframe:** your shipped stack (request/accept + interest-vector + verified-email + XP) is *already* a professional-networking product (Blind/Peerlist/Fishbowl lane) where male skew is a **feature**, connections are one-directional, no scarce-side liquidity is needed, and Indian WTP (recruiting/job-adjacent) **far exceeds dating WTP**. Dating becomes an opt-in surface. This is the most defensible path if the dating ratio proves unsolvable — **zero new code.**

---

## Channel ranking

1. **Direct 1:1 DM recruitment in Bangalore** — density in one social graph is the whole game (`eq('city')` makes scatter arithmetically dead).
2. **r/developersIndia + Indian-tech X + Peerlist (build-in-public)** — great for the discussion phase; dangerous as a dating-seed source (~90% male).
3. **Women-in-tech communities** — the scarce side; approachable only *after* a credible community exists.
4. **Single-company eng clusters (Blind-style)** — makes the feed feel populated and the email gate feel natural.
5. **Product Hunt** — hold for first-1000.
6. ~~**Pan-India Google Form across 5 subreddits (current plan)**~~ — **abandon it.** Worst option: diffuses signups across six cities, leaks the funnel, seeds an all-male pool.

---

## The numbers that matter

- **First metric (dating OFF):** week-1 → week-4 *unprompted human posting retention* — of week-1 signups, % who post/comment (non-founder, non-Gideon) >once and still post in week 4.
- **Kill-test:** over 6-8 weeks, dating OFF — **≥20 real humans post/comment unprompted >once each AND ≥30% of week-1 signups still posting in week 4.**
  - **Hit it** → flip dating on in Bangalore with a managed ratio.
  - **Miss it** → discussion-first thesis is dead. *Don't iterate the dating layer* — the carrot was never the problem. Pivot 1: re-skin to professional-networking (zero new code). Pivot 2: shut it down. Either way you learned for $0 and 6 weeks instead of burning founding goodwill on a public ghost-town.
- **Once dating is on:** scarce-side accepted-request-to-chat-reply rate.

## Monetization reality

Defer entirely; build nothing. Indian dating WTP is structurally low (the TrulyMadly/Woo/Aisle/Dil Mil graveyard). Selling "more swipes" into an empty deck is selling tickets to an empty theatre. **Drop "free premium for life to founders"** — it pre-commits you to never monetizing your most engaged users. Real revenue probability is higher in the professional-networking/recruiting lane than per-swipe premium.

## The uncomfortable truth (red-team, endorsed)

India built the "curated/verified/anti-Tinder" dating app **repeatedly** — TrulyMadly, Woo, Aisle, Dil Mil — *with funding, teams, and PR*, and they serially struggled or died. Female demand is a **demand problem, not an execution problem**: the scarce side often doesn't want to be discoverable/photographed/message-able by a male-skewed tech crowd tied to their employer. A solo male founder with no brand isn't under-resourced for this — he's structurally disqualified from solving it cold. That's *why* you lead with the half that survives thin (community) and keep the half that dies in public (dating) switched off until data earns it.
