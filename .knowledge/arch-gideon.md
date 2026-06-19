---
type: architecture
title: Gideon Agent
description: Python cron seeding discussion posts per genre from HN + dev.to + Lobsters
tags: [gideon, cron, github-actions, content]
timestamp: 2026-06-19T00:00:00Z
---

# Gideon Agent

A Python cron agent that seeds discussion posts so the feed isn't empty. Code in `gideon/` (with `gideon/sources/`); runs via GitHub Actions (`.github/workflows/gideon.yml`) **every 6 hours**.

- **Sources (3):** HN Algolia API + dev.to API + **Lobsters** (`gideon/sources/lobsters.py`, fetches `hottest.json` filtered by per-genre `lobsters_tags` in `genres.json`). All sources fail safe (return `[]` on error) so a source outage never breaks the cron.
- **Dedup + insert:** deduplicates by **URL and normalized title** (`slugify`), inserts up to `MAX_POSTS_PER_GENRE` posts with `is_gideon=true`. The cap defaults to **5** and is env-configurable via `GIDEON_MAX_POSTS_PER_GENRE` (raised from 2 on 2026-06-19 to fix a static cold-start feed).
- **Secrets:** requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions secrets (this path *does* use the service role key, unlike the app's server routes). `GIDEON_RESET=1` wipes Gideon posts before refetch.
- Seeded posts flow into the [feed](arch-feed.md), whose default view now includes them.
