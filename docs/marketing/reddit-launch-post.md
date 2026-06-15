# Await — Reddit / online launch copy (networking framing)

> Companion to `2026-06-15-pilot-launch-first-100.md`. Product is a **tech-discussion + professional-networking** community (Ping → accept → Chat) — **not** dating. Founder-voice, problem-first, honest. Reddit hates ads: lead with the insight, engage in comments, don't drop-and-run.
>
> **Funnel:** link to a **live public post** (`/posts/<slug>` is now public) so people land in a real argument, not a login wall. Put the app link in a top comment on strict subs; never paste a raw promo in the body.

---

## The three things to hammer

1. **A real room, not a feed** — r/developersIndia is great but too big to ever get a reply; this is a smaller place where your post actually gets answered.
2. **NCR-specific** — comp, culture, commute, service-vs-product for Delhi/Noida/Gurugram techies, in NCR dialect.
3. **Connect on ideas, not photos** — Ping someone whose takes you've read, they accept, you chat. No recruiters, no LinkedIn cringe.

Founding-cohort urgency: small + early = you actually get replies and shape the place. Founding badge + roadmap input. (No "verified techies" claim — not real yet. No dating framing.)

---

## PRIMARY POST — r/developersIndia (and r/Noida, r/gurgaon, r/delhi)

**Title (pick one):**
- r/developersIndia is great but too big to ever get a reply — so I built a smaller room for NCR techies to actually argue tech. Roast it.
- Made a tiny discussion community for Delhi-NCR techies (comp, culture, service-vs-product, real talk). Need the first 100 to break it.
- A place where you Ping someone whose takes you've actually read — not a feed, a room. Built it solo, want brutal feedback.

**Body:**

Honest story: the best tech conversations I've had started in comment threads — but the big subs/Discords are so large your post just vanishes, and LinkedIn is all cringe and recruiters. I wanted a smaller *room* where NCR techies actually talk shop and where you can connect with someone because you've read their takes, not because of a photo or a résumé.

So I built **Await** — a tech-discussion community with lightweight networking on top:

- **Post and discuss tech** — AI, web dev, devops, security, startups, databases, NCR comp/culture, the lot. (There's auto-curated HN + dev.to content so it's never an empty feed.)
- **Connect by Ping → accept → chat** — you request, they accept, then you DM. No unsolicited messages, no blind matching.
- **NCR-flavoured** — comp ranges by sector, service-vs-product, the Noida/Gurugram commute math, etc.

The bet: a *small, replied-to* room beats a giant silent feed. If you post, you get an actual conversation.

It's live and working — feed, threaded discussion, profiles, Ping/Chat, the lot. What I need now is real people poking at it. I'm onboarding the **first 100 founding members** — early access, founding badge, and a direct line to shape the roadmap (I'll genuinely read and act on feedback).

Here's a live thread to see the vibe (no signup needed to read): **[LIVE POST LINK]** — and the app's in my first comment.

Please roast it in the comments, including "why will this work when X didn't." I'd rather hear it now.

**TL;DR:** a small room for NCR techies to actually argue tech + connect on ideas (Ping→chat), not a silent feed or a recruiter pit. First 100 founding members — read a live thread: **[LIVE POST LINK]**

---

## VARIANT — r/SideProject / r/indiehackers (builder audience)

**Title:** Built a smaller, actually-gets-replies discussion community for Indian techies (with Ping→chat networking). Looking for the first 100.

**Body:**

Most "communities" are either dead Slacks or feeds too big to get a reply. I wanted to test: **does a small, fast-reply room with networking-on-top retain better than a big silent feed?**

So I built **Await** — tech discussion + a Ping → accept → Chat layer (you connect with people whose posts you've read, not strangers). To keep the feed alive from day one, a small Python agent ("Gideon") pulls fresh HN + dev.to posts per topic.

Stack, for the curious: Next.js 16 + Supabase (Postgres/RLS/Auth/Storage) + Upstash Redis + a Python content agent on GitHub Actions, all free tier. Interest-vector ranking, request/accept flow, block/report/unmatch, human-readable slugs, public shareable post pages.

Live and MVP-complete. Now hunting the **first 100** to see if the core loop holds with real people. Founding members get early access + roadmap input.

See a live thread (no login to read): **[LIVE POST LINK]**

Brutal feedback welcome — especially: does "small room that actually replies" beat "big feed," in your experience?

---

## Posting etiquette

- **Use a real account with history.** Brand-new accounts get auto-filtered; comment karma helps.
- **Check each sub's self-promo rules.** Some need flair ("I made this"/"Showcase"), some ban body links — put the link in a top comment.
- **Best targets (in order):** r/developersIndia → r/Noida / r/gurgaon / r/delhi → r/SideProject → r/indiehackers. Space them out; tailor the title per sub.
- **Bank karma first:** spend 1–2 weeks leaving genuinely useful comments before posting any link.
- **Timing:** weekday mornings IST for r/developersIndia.
- **Reply fast** the first 1–2 hours (drives ranking); treat top comments as a mini-AMA.
- **Never fake upvotes/comments** — Reddit detects it and tanks you.
- **Link to a live thread, not a form** — people convert better landing in a real argument they can read without signing up.

## A/B angles to test
"Small room that actually replies" (anti-big-feed) vs "NCR-specific comp/culture talk" (local) vs "connect on ideas, Ping→chat" (anti-LinkedIn). Lead with whatever the target sub resonates with. **Do not** use any dating or "verified techies" angle.
