---
type: architecture
title: Gideon Agent
description: Python cron seeding discussion posts per genre from 6 sources (HN, dev.to, Lobsters, Reddit, arXiv, GitHub) with normalized cross-source ranking
tags: [gideon, cron, github-actions, content]
timestamp: 2026-06-30T00:00:00Z
---

# Gideon Agent

A Python cron agent that seeds discussion posts so the feed isn't empty. Code in `gideon/` (with `gideon/sources/`); runs via GitHub Actions (`.github/workflows/gideon.yml`) **every 6 hours**.

- **Sources (6):** all in `gideon/sources/`, all fail safe (return `[]` on error) so one outage never breaks the cron. Per-genre config lives in `genres.json`.
  - **HN** Algolia API (`hackernews.py`, `hn_query` + `hn_tags`)
  - **dev.to** API (`devto.py`, `devto_tags`)
  - **Lobsters** (`lobsters.py`, `hottest.json` filtered by `lobsters_tags`)
  - **Reddit** (`reddit.py`, `subreddits`) — **app-only OAuth** via `oauth.reddit.com` (client-credentials token from `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`). The public `www.reddit.com/.json` host returns `403 Blocked` for datacenter IPs (incl. GitHub Actions), so OAuth is required; **without the creds the Reddit source no-ops** (prints a skip notice, returns `[]`).
  - **arXiv** (`arxiv.py`, `arxiv_query`) — newest papers via the Atom export API (stdlib XML parse). Only the 4 genres with an `arxiv_query` (ai, llms, cybersecurity, databases); others skip it. `points=0` (no popularity signal).
  - **GitHub** (`github.py`, `github_query`) — repo search by topic, most-starred, pushed in last ~90 days. Optional `GITHUB_TOKEN` (auto-provided in Actions) raises the search rate limit; works keyless otherwise. `image_url` left None so the `fetch.py` og-scraper grabs the repo social card.
- **Ranking — `merge_normalized` (fetch.py):** each source's posts are scored 0–1 relative to **that source's own max** points; a source whose max is 0 (arXiv) gets a flat **0.5** so it competes instead of always sinking under a raw-points sort (sources' point scales differ by orders of magnitude — GitHub stars vs HN points). Replaces the old raw `points` sort. The `_score` key is internal-only and never reaches the DB (`insert_posts` builds an explicit column dict).
- **Dedup + insert:** deduplicates by **URL and normalized title** (`slugify`), inserts up to `MAX_POSTS_PER_GENRE` posts with `is_gideon=true`. The cap defaults to **5** and is env-configurable via `GIDEON_MAX_POSTS_PER_GENRE` (raised from 2 on 2026-06-19 to fix a static cold-start feed).
- **Secrets:** requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions secrets (this path *does* use the service role key, unlike the app's server routes). Optional: `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` (free "script" app), `GITHUB_TOKEN`. `GIDEON_RESET=1` wipes Gideon posts before refetch.
- **DB constraint dependency:** `posts.source` is gated by the `posts_source_check` CHECK. Every new source value MUST be added there or the run crashes (postgrest 23514) on first insert. Migration **029** added `reddit`/`arxiv`/`github` (after 027 added `lobsters`). Adding a 7th source = new migration too.
- **HN query gotcha (fixed 2026-06-30):** HN Algolia (a) removed `points` from `numericAttributesForFiltering` → a server-side `points>N` filter now `400`s ("invalid numeric attribute"), and (b) treats `OR` in a query as a literal token, not boolean (the `"X OR Y"` genre queries matched ~0). Fix in `hackernews.py`: filter `points > MIN_POINTS` **client-side** (over-fetch ×4, sort by points), and convert the genre `hn_query` `"X OR Y OR Z"` to Algolia **`optionalWords`** for real OR semantics. `genres.json` keeps the readable OR form. HN now contributes again.
- **Verified live 2026-06-30:** a prod cron run inserted github/devto/arxiv/lobsters across genres (and HN after its fix); Reddit no-ops until its secrets exist; push fan-out fired.
- Seeded posts flow into the [feed](arch-feed.md), whose default view now includes them.

> **X.com** was considered and dropped — no free, cron-safe read path (paid API tier; Nitter dead; scraping breaks under an unattended cron).
