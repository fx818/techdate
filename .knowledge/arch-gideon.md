---
type: architecture
title: Gideon Agent
description: Python cron seeding posts from 6 sources with normalized ranking and an optional LLM quality gate
tags: [gideon, cron, github-actions, content, llm-judge]
timestamp: 2026-06-30T12:00:00Z
---

# Gideon Agent

A Python cron agent that seeds discussion posts so the feed isn't empty. Code in `gideon/` (with `gideon/sources/`); runs via GitHub Actions (`.github/workflows/gideon.yml`) **every 6 hours**.

- **Sources (6):** all in `gideon/sources/`, all fail safe (return `[]` on error). Per-genre config in `genres.json`. HN, dev.to, Lobsters, Reddit (app-only OAuth — public host 403s on datacenter IPs; no-ops without creds), arXiv (Atom API, AI-ish genres only, `points=0`), GitHub (repo search by topic, most-starred).
- **Ranking — `merge_normalized` (fetch.py):** scores each source's posts 0–1 relative to that source's own max; zero-max sources (arXiv) get flat 0.5. `_score` is internal, never reaches DB.
- **Pipeline (fetch.py `run()`):** `merge_normalized` → `dedup_candidates` (URL + slugified-title dedup) → judge (if active) else `unique[:MAX]` → `insert_records`.
- **LLM judge — `gideon/judge.py` (migration 031):** optional quality gate controlled by the `gideon_judge_config` singleton (table + RPCs). Active only when `enabled=true` **and** an `api_key` is set (enabled-but-no-key logs a warning and stays inactive). When active, `select_with_judge` walks the deduped, ranked candidates and calls an OpenAI-compatible `/chat/completions` endpoint (default: Gemini via `base_url` + `api_key`), keeping posts scoring ≥ `pass_threshold` (0–10, default 6) and **backfilling** down the list until `MAX_POSTS_PER_GENRE` pass or the pool is exhausted. **Fail-open throughout** — config missing/disabled inserts the ranked top-N; any per-post error (network, HTTP, JSON parse) keeps that post. Config read by Gideon via the service-role client (bypasses RLS); raw `api_key` never leaves the server (RPCs expose only `key_set` + `key_last4`). Tests: `gideon/tests/` (run `cd gideon && python -m pytest tests/`).
- **Insert:** up to `MAX_POSTS_PER_GENRE` (env `GIDEON_MAX_POSTS_PER_GENRE`, default 5) with `is_gideon=true`.
- **Secrets / ops:** requires `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` (this path *does* use the service-role key). Optional: `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET`, `GITHUB_TOKEN`. `GIDEON_RESET=1` wipes Gideon posts before refetch.
- **DB constraint:** `posts_source_check` CHECK must include every source value or inserts crash (23514) on first insert — **adding a source = new migration too**. Full set: `hackernews|devto|xcom|user|lobsters|reddit|arxiv|github` (migrations 027, 029).
- **HN fix (2026-06-30):** Algolia removed `points` from numeric filters → filter client-side; `"X OR Y"` queries now use `optionalWords` for real OR semantics.
- Seeded posts flow into the [feed](arch-feed.md). Judge config managed from [/admin/gideon](arch-moderation.md).

> **X.com** dropped — no free, cron-safe read path.
