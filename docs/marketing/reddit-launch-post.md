# Await — Reddit launch post (first 100 users)

> Goal: drive the first 100 founding members to a Google Form. Reddit hates ads — every version below is written founder-voice, problem-first, and honest. Lead with the insight, not the product. Engage in the comments; don't drop-and-run.
>
> Replace `[FORM LINK]` with your Google Form URL before posting. Don't paste the live app URL in the post body on strict subs — put it in a comment if asked.

---

## Positioning (the one idea everything ladders up to)

**Dating apps reward looks and persistence. Await rewards being interesting.**

You don't start by swiping strangers. You join a tech-discussion community, earn XP by actually participating, and only then does dating unlock — so the people you meet are people whose ideas you've already seen. Verified to real tech professionals (company email), request → accept instead of blind matching, no bots.

The three things to hammer in any channel:
1. **Merit-gated, not looks-gated** — you earn your way in by contributing.
2. **Verified techies only** — company-email verification → no fakes, no spam.
3. **Discussion-first** — it's a community that *leads to* dating, not a meat-market that pretends to be one.

Urgency for the first 100: **founding members** (early access, founding badge, free premium at launch, and a real say in the roadmap). Small + curated early = higher signal for everyone.

---

## PRIMARY POST — for r/developersIndia (and city subs like r/bangalore, r/delhi)

**Title (pick one):**
- I got tired of dating apps where no one could hold a conversation about anything I actually care about — so I built one for tech people where you *earn* your way to matches.
- A dating app that makes you prove you're interesting first. Built it, need the first 100 to break it.
- Discussion-first dating for Indian techies: talk shop, earn your way in, then meet people who actually get it.

**Body:**

Honest story: every dating app I've tried feels like a slot machine. Endless swiping, zero substance, and I could never tell if the person on the other end cared about any of the things I do. Meanwhile the best conversations I've ever had started in comment threads, Discord servers, HN — places where people show up for the *ideas* first.

So I built **Await**, which flips the order. You don't start by swiping. You start by being part of a tech community:

- **Post and discuss tech** — AI, web dev, devops, security, startups, databases, etc. (there's auto-curated content from HackerNews + dev.to so the feed is never empty on day one).
- **Every like, comment, and post earns XP.**
- **At 100 XP the dating layer unlocks** — and now you can connect, but only with other people who've also shown up and engaged.
- It's **request → accept**, not blind mutual swiping, and everyone is a **verified tech professional** (company-email check), so no bots and no randoms.

The whole bet: **if you have to be interesting to unlock dating, the people you meet are actually worth meeting.** You're matching with someone whose takes you've already read — not a stranger and a vibe.

It's live and working — auth, feed, threaded discussion, matching, chat, the lot. What I need now is the part that actually matters: real people using it.

I'm onboarding the **first 100 founding members** through a short form. Founding members get early access, a founding-member badge, free premium when it launches, and a direct line to shape what this becomes — I'll genuinely read and act on the feedback.

If "a tech community that happens to lead to dating" is something you'd want to exist, here's the form (60 seconds): **[FORM LINK]**

And please — roast it in the comments. Including "why will this work when X didn't." I'd rather hear it now than later.

**TL;DR:** discussion-first dating for techies — earn your way in by being interesting, verified professionals only, no swipe spam. First 100 founding members → **[FORM LINK]**

---

## VARIANT — for r/SideProject / r/indiehackers (builder audience)

**Title:** I built a dating app where you have to earn dating by being active in a tech community first. Looking for the first 100 to validate it.

**Body:**

Most dating apps optimize for swipes. I wanted to test a different hypothesis: **what if you had to contribute to a community before you could date in it?**

So I built **Await** — a tech discussion platform with a dating layer that unlocks at 100 XP (earned via posts/comments/likes). The idea is that gating dating behind genuine participation self-selects for people worth meeting, and turns "engagement" into something with an actual payoff.

Stack, for the curious: Next.js 16 + Supabase (Postgres/RLS/Auth/Storage) + Upstash Redis + a Python content agent on GitHub Actions, all on free tiers. Interest-vector matching (cosine sim + activity recency), request/accept flow, company-email verification, block/report/unmatch, the usual safety stuff.

It's live and feature-complete for an MVP. Now I'm hunting for the **first 100 users** to find out if the core loop actually holds up with real people. Founding members get early access + free premium at launch + roadmap input.

Form (60s): **[FORM LINK]**

Brutal feedback welcome — especially on the core hypothesis. Does "earn your way into dating" sound compelling or gimmicky to you?

---

## Posting strategy / etiquette

- **Use a real account with history.** Brand-new accounts get auto-filtered; comments-only karma helps.
- **Check each sub's self-promo rules first.** Some require flair (e.g. "Showcase"/"I made this"), some ban links in the body — put the form link in a top comment if so.
- **Best targets (in order):** r/developersIndia (core audience), r/SideProject, r/indiehackers, then city subs (r/bangalore, r/delhi, r/hyderabad) where dating-relevant. Avoid blasting all at once — space them out, tailor the title per sub.
- **Timing:** weekday mornings IST tend to do well for r/developersIndia.
- **Reply fast** for the first 1–2 hours (early engagement drives ranking). Treat top comments like a mini-AMA.
- **Don't fake it.** No sockpuppet upvotes/comments — Reddit detects it and it'll tank you.
- **Have the form ready:** ask only the essentials (name, email, city, primary tech interest, "what do you want from this"). Every extra field drops completion. Auto-reply with a thank-you + "you're in the first 100" to create momentum.

## A/B angles to test across posts
- "Earn your way in" (merit) vs "verified techies only" (trust/quality) vs "no more swiping strangers" (anti-Tinder). Lead with whichever the target sub resonates with most.
