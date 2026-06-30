# Gideon: Expand Content Sources (3 → 6)

**Date:** 2026-06-30
**Status:** Approved (design)
**Area:** `gideon/` content-seeding cron

## Goal

Diversify the Gideon feed so it stops recycling the same stories. Add three new
keyless, cron-safe content sources alongside the existing HN + dev.to + Lobsters,
taking Gideon from **3 → 6 sources**.

New sources: **Reddit**, **arXiv**, **GitHub** (repository search).

X.com was considered and **dropped**: no free, cron-safe read path exists (official
API read access is paid Basic+ tier; Nitter is dead; scraping violates ToS and
breaks under an unattended cron).

## Constraints / Invariants

- **No new pip dependencies.** All sources use `httpx` (already present); arXiv uses
  stdlib `xml.etree.ElementTree`.
- **No DB schema change, no migration.** New posts use the existing `posts` columns.
- **Every source fails safe** — returns `[]` on any error so one source outage never
  breaks the cron. Same contract as the existing three sources.
- Each source module exposes a single `fetch_*_posts(...)` returning a list of dicts:
  `{title, url, content, image_url, points, source}`.

## Components

### 1. `gideon/sources/reddit.py` — `fetch_reddit_posts(subreddits: list, limit=8)`

- For each subreddit: `GET https://www.reddit.com/r/{sub}/hot.json?limit={limit}&raw_json=1`
  with a descriptive `User-Agent` header (Reddit returns 429 for empty/default UAs).
- Per child post:
  - Skip `stickied` and `over_18`.
  - `title` = `data.title`.
  - `url` = `data.url_overridden_by_dest` (external link); for self-posts fall back to
    `https://www.reddit.com{permalink}`.
  - `content` = cleaned `selftext` excerpt, ~600 char cap (None if empty).
  - `image_url` = `data.preview.images[0].source.url` (HTML-unescaped) if present, else
    `data.thumbnail` when it is a real URL, else None.
  - `points` = `data.score`.
  - `source` = `"reddit"`.
- Fail-safe **per subreddit** — one bad subreddit doesn't kill the rest.

### 2. `gideon/sources/arxiv.py` — `fetch_arxiv_posts(query: str, limit=6)`

- Empty/blank `query` → return `[]` immediately (genres without arXiv coverage).
- `GET http://export.arxiv.org/api/query?search_query={query}&sortBy=submittedDate&sortOrder=descending&max_results={limit}`.
- Response is Atom XML → parse with stdlib `xml.etree.ElementTree` (no new dep).
- Per entry:
  - `title` = entry title (whitespace-collapsed).
  - `url` = the abstract link (`<id>` / `rel="alternate"` link).
  - `content` = `<summary>` (abstract), cleaned + capped.
  - `image_url` = None (arXiv exposes none).
  - `points` = `0` (no popularity signal — relies on normalization below to compete).
  - `source` = `"arxiv"`.

### 3. `gideon/sources/github.py` — `fetch_github_posts(query: str, limit=6)`

- Empty/blank `query` → return `[]`.
- `GET https://api.github.com/search/repositories?q={query}&sort=stars&order=desc&per_page={limit}`
  with `Accept: application/vnd.github+json` and a UA.
- `query` includes a recency filter (`pushed:>{~90 days ago}`, date computed with
  `datetime`) so results favor active repos.
- If `GITHUB_TOKEN` env is set, send it as a bearer token to raise the rate limit
  (search: 10 → 30 req/min). Works keyless otherwise.
- Per repo:
  - `title` = `full_name`.
  - `url` = `html_url`.
  - `content` = `description` (None if empty).
  - `image_url` = None — `fetch_og_image` in `fetch.py` scrapes GitHub's repo social
    card automatically, so repo posts still get a thumbnail.
  - `points` = `stargazers_count`.
  - `source` = `"github"`.

### 4. `gideon/genres.json` — new per-genre config keys

- `subreddits`: list of subreddit names — **all 10 genres**.
- `github_query`: topic-based search string — **all 10 genres** (e.g. webdev →
  `topic:react topic:nextjs`).
- `arxiv_query`: search string — **only genres where it fits**: `ai`, `llms`,
  `cybersecurity`, `databases`. Genres without it → arXiv returns `[]` (same optional
  pattern as today's `lobsters_tags`, read via `config.get(...)`).

### 5. `gideon/fetch.py` — normalized merge (replaces raw `points` sort)

New helper:

```python
def merge_normalized(source_lists: list) -> list:
    """Per source, normalize points to 0–1 (relative to that source's own max), then
    merge and sort. A source whose max is 0 (e.g. arXiv) gets a flat 0.5 so it still
    competes instead of always sinking to the bottom under a raw-points sort."""
    scored = []
    for posts in source_lists:
        if not posts:
            continue
        mx = max((p.get("points", 0) or 0) for p in posts)
        for p in posts:
            pts = p.get("points", 0) or 0
            p["_score"] = (pts / mx) if mx > 0 else 0.5
            scored.append(p)
    scored.sort(key=lambda p: p.get("_score", 0), reverse=True)
    return scored
```

- `run()` gains three fetch calls (all via `config.get(...)`, so missing keys are safe):
  ```python
  reddit_posts  = fetch_reddit_posts(config.get("subreddits", []))
  arxiv_posts   = fetch_arxiv_posts(config.get("arxiv_query", ""))
  github_posts  = fetch_github_posts(config.get("github_query", ""))
  ```
- Replace the single `all_posts.sort(key=lambda p: p.get("points", 0), reverse=True)`
  with `all_posts = merge_normalized([hn_posts, devto_posts, lobsters_posts, reddit_posts, arxiv_posts, github_posts])`.
- `_score` is an **internal-only** key. `insert_posts` builds an explicit DB dict, so
  `_score` never reaches the schema. No DB change.
- Dedupe (URL + title-slug) and `MAX_POSTS_PER_GENRE` cap are unchanged.

## Data Flow

```
per genre:
  hn / devto / lobsters / reddit / arxiv / github  → fetch_*_posts() → list[dict]
  merge_normalized([...lists...])  → per-source 0–1 score, merged, sorted desc
  insert_posts(...)                → dedupe (URL + slug), cap at MAX_POSTS_PER_GENRE
  → posts rows (is_gideon=true)    → existing broadcast-push step (unchanged)
```

## Error Handling

- Each source wraps network/parse in try/except → returns `[]` (and prints a diagnostic).
- Reddit: per-subreddit isolation.
- GitHub: 429 / rate-limit → `[]` (fail-safe); optional `GITHUB_TOKEN` mitigates.
- arXiv: blank query short-circuits to `[]`.

## Rate Limits

- **Reddit:** requires a real `User-Agent` or it 429s. Low volume (a few subs/genre).
- **GitHub:** unauthenticated search ≈ 10 req/min; ~10 genres × 1 call ≈ 10 calls/run —
  borderline. Mitigated by optional `GITHUB_TOKEN` (raises to 30/min) and fail-safe `[]`.
- **arXiv:** requests ≤ 1 per 3s; our handful of calls is well under.

## Testing

The repo has **no Python test harness** (app tests are Vitest/JS under `tests/lib/`).
Matching existing convention:

- Add an `if __name__ == "__main__":` smoke-print to each new source module so it can be
  run standalone to confirm it returns well-formed dicts.
- Verify end-to-end with a real `python gideon/fetch.py` run (optionally `GIDEON_RESET=1`
  against a scratch/non-prod project) and confirm posts from all six sources appear.

## Out of Scope

- X.com integration (dropped — no free cron-safe path).
- Any DB schema / migration change.
- New pip dependencies.
- Changes to the broadcast-push step.

## Docs to Update (post-implementation)

- `CLAUDE.md` — Gideon section: sources 3 → 6; also fix the stale "every 4 hours" (→ 6h)
  and "up to 6 posts/genre" (→ 5, env-configurable) noted during review.
- `.knowledge/arch-gideon.md` (+ `index.md` line + `log.md` entry) via `/okf-sync`.
- `README.md` if it enumerates sources.
