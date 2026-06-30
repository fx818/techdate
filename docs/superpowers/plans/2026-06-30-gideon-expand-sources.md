# Gideon Expand Sources Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three new keyless, cron-safe content sources (Reddit, arXiv, GitHub) to the Gideon seeding cron, taking it from 3 → 6 sources, with normalized cross-source ranking.

**Architecture:** Each source is a self-contained module in `gideon/sources/` exposing one `fetch_*_posts(...)` function returning the standard post dict and failing safe (`[]` on error). `gideon/fetch.py` gains a `merge_normalized()` helper that scores each source's posts 0–1 relative to that source's own max (flat 0.5 when a source has no points, e.g. arXiv), then merges and sorts — replacing the raw `points` sort. Per-genre source config lives in `gideon/genres.json`.

**Tech Stack:** Python 3, `httpx` (already a dep), stdlib `xml.etree.ElementTree` (arXiv), Supabase Python client. No new pip dependencies.

## Global Constraints

- **No new pip dependencies** — `httpx` only (already in `gideon/requirements.txt`); arXiv uses stdlib `xml.etree.ElementTree`.
- **Reddit uses free app-only OAuth** (revised during impl): `www.reddit.com/.json` 403-blocks datacenter IPs, so the module reads `oauth.reddit.com` with a client-credentials token from `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` env. Absent creds → prints skip notice, returns `[]` (graceful no-op). These two are new optional GitHub Actions secrets.
- **No DB schema change, no migration** — new posts reuse existing `posts` columns.
- **Every source fails safe** — returns `[]` on any error; never raises into the cron.
- **Standard post dict contract:** every source returns a list of `{title, url, content, image_url, points, source}`.
- **No Python test harness exists** — verification is via each module's `if __name__ == "__main__"` self-check (runnable standalone, asserts dict shape) plus a final real `python gideon/fetch.py` run. Do NOT introduce pytest.
- **X.com is out of scope** (no free cron-safe read path).

---

### Task 1: Reddit source module

**Files:**
- Create: `gideon/sources/reddit.py`

**Interfaces:**
- Consumes: optional env `REDDIT_CLIENT_ID`, `REDDIT_CLIENT_SECRET`.
- Produces: `fetch_reddit_posts(subreddits: list, limit: int = 8) -> list[dict]`, each dict `{title, url, content, image_url, points, source="reddit"}`. No creds → `[]`.

- [ ] **Step 1: Write the module**

Create `gideon/sources/reddit.py`:

```python
import html
import os

import httpx

UA = "GideonBot/1.0 (+await; content aggregator)"
TOKEN_URL = "https://www.reddit.com/api/v1/access_token"
OAUTH_BASE = "https://oauth.reddit.com"


def _clean(text: str) -> str:
    return " ".join((text or "").split()).strip()


def _get_token() -> str | None:
    """App-only (userless) OAuth token via client-credentials. Returns None when creds
    are absent or the request fails — caller then yields no posts (fail-safe). Needed
    because www.reddit.com/.json returns 403 Blocked for datacenter IPs (the cron's
    GitHub Actions runners); oauth.reddit.com works with a token."""
    client_id = os.environ.get("REDDIT_CLIENT_ID")
    client_secret = os.environ.get("REDDIT_CLIENT_SECRET")
    if not client_id or not client_secret:
        print("reddit: REDDIT_CLIENT_ID/SECRET not set — skipping Reddit source")
        return None
    try:
        r = httpx.post(
            TOKEN_URL,
            auth=(client_id, client_secret),
            data={"grant_type": "client_credentials"},
            headers={"User-Agent": UA},
            timeout=10,
        )
        r.raise_for_status()
        return r.json().get("access_token")
    except Exception as e:
        print(f"reddit token error: {e}")
        return None


def fetch_reddit_posts(subreddits: list, limit: int = 8) -> list:
    """Fetch hot posts per subreddit via Reddit's app-only OAuth API. Requires
    REDDIT_CLIENT_ID + REDDIT_CLIENT_SECRET; without them returns [] (graceful no-op).
    Fails safe per subreddit so one bad sub never breaks the run. Same dict contract
    as the other sources."""
    if not subreddits:
        return []
    token = _get_token()
    if not token:
        return []
    headers = {"Authorization": f"bearer {token}", "User-Agent": UA}
    posts = []
    for sub in subreddits:
        try:
            r = httpx.get(
                f"{OAUTH_BASE}/r/{sub}/hot",
                params={"limit": limit, "raw_json": 1},
                headers=headers,
                timeout=10,
            )
            r.raise_for_status()
            children = r.json().get("data", {}).get("children", [])
        except Exception as e:
            print(f"reddit fetch error for r/{sub}: {e}")
            continue

        for child in children:
            d = child.get("data", {})
            if d.get("stickied") or d.get("over_18"):
                continue
            title = d.get("title", "")
            if not title or len(title) <= 10:
                continue
            permalink = d.get("permalink", "")
            url = d.get("url_overridden_by_dest") or (
                f"https://www.reddit.com{permalink}" if permalink else ""
            )
            if not url:
                continue
            content = _clean(d.get("selftext", ""))[:600] or None
            image_url = None
            preview = d.get("preview", {})
            images = preview.get("images") if isinstance(preview, dict) else None
            if images:
                src = images[0].get("source", {}).get("url")
                if src:
                    image_url = html.unescape(src)
            if not image_url:
                thumb = d.get("thumbnail", "")
                if isinstance(thumb, str) and thumb.startswith("http"):
                    image_url = thumb
            posts.append({
                "title": title,
                "url": url,
                "content": content,
                "image_url": image_url,
                "points": d.get("score", 0) or 0,
                "source": "reddit",
            })
    return posts


if __name__ == "__main__":
    sample = fetch_reddit_posts(["programming"], limit=5)
    print(f"reddit: {len(sample)} posts")
    for p in sample[:3]:
        assert {"title", "url", "content", "image_url", "points", "source"} <= p.keys()
        print(f"  [{p['points']}] {p['title'][:70]}")
```

- [ ] **Step 2: Run the self-check**

Run (from repo root): `python gideon/sources/reddit.py`
Expected (no creds set): prints `reddit: REDDIT_CLIENT_ID/SECRET not set — skipping Reddit source` then `reddit: 0 posts`, exit 0, no assertion error. With creds set: `reddit: N posts` (N ≥ 1) and 1–3 sample lines. Real parsing is verified once creds exist (locally via env, or in the cron).

- [ ] **Step 3: Commit**

```bash
git add gideon/sources/reddit.py
git commit -m "feat(gideon): add Reddit source"
```

---

### Task 2: arXiv source module

**Files:**
- Create: `gideon/sources/arxiv.py`

**Interfaces:**
- Consumes: nothing.
- Produces: `fetch_arxiv_posts(query: str, limit: int = 6) -> list[dict]`, each dict `{title, url, content, image_url=None, points=0, source="arxiv"}`. Blank `query` → `[]`.

- [ ] **Step 1: Write the module**

Create `gideon/sources/arxiv.py`:

```python
import xml.etree.ElementTree as ET

import httpx

ARXIV_API = "http://export.arxiv.org/api/query"
ATOM = "{http://www.w3.org/2005/Atom}"
MAX_CONTENT = 800


def _clean(text: str) -> str:
    return " ".join((text or "").split()).strip()


def fetch_arxiv_posts(query: str, limit: int = 6) -> list:
    """Fetch newest arXiv papers for a search query (Atom XML, stdlib parse). Blank
    query -> [] (genres with no arXiv coverage). Fails safe. points=0 (no popularity
    signal — relies on fetch.py's normalized merge to compete)."""
    if not query or not query.strip():
        return []
    try:
        r = httpx.get(
            ARXIV_API,
            params={
                "search_query": query,
                "sortBy": "submittedDate",
                "sortOrder": "descending",
                "max_results": limit,
            },
            headers={"User-Agent": "GideonBot/1.0 (+await)"},
            timeout=15,
        )
        r.raise_for_status()
        root = ET.fromstring(r.text)
    except Exception as e:
        print(f"arxiv fetch error: {e}")
        return []

    posts = []
    for entry in root.findall(f"{ATOM}entry"):
        title = _clean(entry.findtext(f"{ATOM}title", ""))
        if not title or len(title) <= 10:
            continue
        url = ""
        for link in entry.findall(f"{ATOM}link"):
            if link.get("rel") == "alternate":
                url = link.get("href", "")
                break
        if not url:
            url = _clean(entry.findtext(f"{ATOM}id", ""))
        if not url:
            continue
        content = _clean(entry.findtext(f"{ATOM}summary", ""))[:MAX_CONTENT] or None
        posts.append({
            "title": title,
            "url": url,
            "content": content,
            "image_url": None,
            "points": 0,
            "source": "arxiv",
        })
    return posts


if __name__ == "__main__":
    assert fetch_arxiv_posts("") == [], "blank query must short-circuit to []"
    sample = fetch_arxiv_posts("cat:cs.AI", limit=5)
    print(f"arxiv: {len(sample)} posts")
    for p in sample[:3]:
        assert {"title", "url", "content", "image_url", "points", "source"} <= p.keys()
        assert p["points"] == 0
        print(f"  {p['title'][:70]}")
```

- [ ] **Step 2: Run the self-check**

Run: `python gideon/sources/arxiv.py`
Expected: prints `arxiv: N posts` (N ≥ 1) with sample titles, no assertion error.

- [ ] **Step 3: Commit**

```bash
git add gideon/sources/arxiv.py
git commit -m "feat(gideon): add arXiv source"
```

---

### Task 3: GitHub source module

**Files:**
- Create: `gideon/sources/github.py`

**Interfaces:**
- Consumes: nothing. Reads optional `GITHUB_TOKEN` env.
- Produces: `fetch_github_posts(query: str, limit: int = 6) -> list[dict]`, each dict `{title, url, content, image_url=None, points, source="github"}`. Blank `query` → `[]`.

- [ ] **Step 1: Write the module**

Create `gideon/sources/github.py`:

```python
import os
from datetime import datetime, timedelta, timezone

import httpx

GITHUB_SEARCH = "https://api.github.com/search/repositories"


def fetch_github_posts(query: str, limit: int = 6) -> list:
    """Search GitHub repos for a topic query, most-starred first, restricted to repos
    pushed in the last ~90 days (favor active projects). Blank query -> []. Fails safe.
    Optional GITHUB_TOKEN raises the search rate limit (10 -> 30 req/min)."""
    if not query or not query.strip():
        return []
    since = (datetime.now(timezone.utc) - timedelta(days=90)).strftime("%Y-%m-%d")
    q = f"{query} pushed:>{since}"
    headers = {
        "Accept": "application/vnd.github+json",
        "User-Agent": "GideonBot/1.0 (+await)",
    }
    token = os.environ.get("GITHUB_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"
    try:
        r = httpx.get(
            GITHUB_SEARCH,
            params={"q": q, "sort": "stars", "order": "desc", "per_page": limit},
            headers=headers,
            timeout=15,
        )
        r.raise_for_status()
        items = r.json().get("items", [])
    except Exception as e:
        print(f"github fetch error: {e}")
        return []

    posts = []
    for repo in items:
        title = repo.get("full_name", "")
        url = repo.get("html_url", "")
        if not title or not url:
            continue
        description = (repo.get("description") or "").strip()
        posts.append({
            "title": title,
            "url": url,
            "content": description or None,
            "image_url": None,  # fetch.py og-scraper grabs GitHub's repo social card
            "points": repo.get("stargazers_count", 0) or 0,
            "source": "github",
        })
    return posts


if __name__ == "__main__":
    assert fetch_github_posts("") == [], "blank query must short-circuit to []"
    sample = fetch_github_posts("topic:react", limit=5)
    print(f"github: {len(sample)} posts")
    for p in sample[:3]:
        assert {"title", "url", "content", "image_url", "points", "source"} <= p.keys()
        print(f"  [{p['points']}*] {p['title']}")
```

- [ ] **Step 2: Run the self-check**

Run: `python gideon/sources/github.py`
Expected: prints `github: N posts` (N ≥ 1) with `owner/repo` titles and star counts, no assertion error. (Unauthenticated rate-limit hit → fetch error + `github: 0 posts`; acceptable fail-safe, re-run later or set `GITHUB_TOKEN`.)

- [ ] **Step 3: Commit**

```bash
git add gideon/sources/github.py
git commit -m "feat(gideon): add GitHub repo-search source"
```

---

### Task 4: Per-genre config in genres.json

**Files:**
- Modify: `gideon/genres.json`

**Interfaces:**
- Produces: each genre object gains `subreddits` (list) and `github_query` (string) for all genres; `arxiv_query` (string) only for `ai`, `llms`, `cybersecurity`, `databases`. Consumed by Task 5's `run()` via `config.get(...)`.

- [ ] **Step 1: Replace the file contents**

Overwrite `gideon/genres.json` with (existing keys preserved, new keys added):

```json
{
  "ai": {
    "hn_tags": ["machine-learning", "artificial-intelligence", "deep-learning"],
    "hn_query": "AI OR LLM OR GPT OR neural",
    "devto_tags": ["ai", "machinelearning", "deeplearning"],
    "lobsters_tags": ["ai"],
    "subreddits": ["MachineLearning", "artificial"],
    "github_query": "topic:machine-learning topic:deep-learning",
    "arxiv_query": "cat:cs.AI OR cat:cs.LG"
  },
  "llms": {
    "hn_tags": ["llm", "gpt", "language-model"],
    "hn_query": "LLM OR GPT OR Claude OR Gemini OR language model",
    "devto_tags": ["llm", "gpt4", "openai"],
    "lobsters_tags": ["ai"],
    "subreddits": ["LocalLLaMA", "OpenAI"],
    "github_query": "topic:llm topic:large-language-models",
    "arxiv_query": "cat:cs.CL"
  },
  "webdev": {
    "hn_tags": ["web", "javascript", "react", "css"],
    "hn_query": "React OR Next.js OR web development OR frontend",
    "devto_tags": ["webdev", "javascript", "react", "css"],
    "lobsters_tags": ["web", "javascript", "css"],
    "subreddits": ["webdev", "javascript"],
    "github_query": "topic:react topic:nextjs"
  },
  "devops": {
    "hn_tags": ["devops", "docker", "kubernetes", "ci-cd"],
    "hn_query": "DevOps OR Docker OR Kubernetes OR CI/CD",
    "devto_tags": ["devops", "docker", "kubernetes"],
    "lobsters_tags": ["devops"],
    "subreddits": ["devops", "kubernetes"],
    "github_query": "topic:devops topic:kubernetes"
  },
  "mobile": {
    "hn_tags": ["ios", "android", "mobile"],
    "hn_query": "iOS OR Android OR React Native OR Flutter",
    "devto_tags": ["android", "ios", "flutter", "reactnative"],
    "lobsters_tags": ["mobile", "ios", "android"],
    "subreddits": ["androiddev", "iOSProgramming"],
    "github_query": "topic:android topic:ios"
  },
  "cloud": {
    "hn_tags": ["aws", "gcp", "azure", "cloud"],
    "hn_query": "AWS OR GCP OR Azure OR cloud computing",
    "devto_tags": ["aws", "cloud", "azure", "googlecloud"],
    "lobsters_tags": ["devops", "distributed"],
    "subreddits": ["aws", "devops"],
    "github_query": "topic:aws topic:cloud"
  },
  "cybersecurity": {
    "hn_tags": ["security", "hacking", "cryptography"],
    "hn_query": "security OR vulnerability OR CVE OR hacking",
    "devto_tags": ["security", "cybersecurity", "hacking"],
    "lobsters_tags": ["security", "privacy", "cryptography"],
    "subreddits": ["netsec", "cybersecurity"],
    "github_query": "topic:security topic:hacking",
    "arxiv_query": "cat:cs.CR"
  },
  "opensource": {
    "hn_tags": ["open-source", "github"],
    "hn_query": "open source OR GitHub OR OSS",
    "devto_tags": ["opensource", "github"],
    "lobsters_tags": ["programming"],
    "subreddits": ["opensource", "programming"],
    "github_query": "topic:open-source"
  },
  "startups": {
    "hn_tags": ["startup", "entrepreneurship"],
    "hn_query": "startup OR founder OR YC OR seed round",
    "devto_tags": ["startup", "entrepreneurship", "business"],
    "lobsters_tags": ["culture"],
    "subreddits": ["startups", "Entrepreneur"],
    "github_query": "topic:startup"
  },
  "databases": {
    "hn_tags": ["database", "postgresql", "sql", "nosql"],
    "hn_query": "database OR PostgreSQL OR MySQL OR MongoDB",
    "devto_tags": ["database", "sql", "postgres", "mongodb"],
    "lobsters_tags": ["databases"],
    "subreddits": ["Database", "PostgreSQL"],
    "github_query": "topic:database topic:postgresql",
    "arxiv_query": "cat:cs.DB"
  }
}
```

- [ ] **Step 2: Verify it parses**

Run: `python -c "import json; d=json.load(open('gideon/genres.json')); print(len(d), 'genres'); print(sum('arxiv_query' in v for v in d.values()), 'with arxiv')"`
Expected: `10 genres` and `4 with arxiv`.

- [ ] **Step 3: Commit**

```bash
git add gideon/genres.json
git commit -m "feat(gideon): per-genre subreddits, github_query, arxiv_query config"
```

---

### Task 5: Wire new sources + normalized merge into fetch.py

**Files:**
- Modify: `gideon/fetch.py` (imports near lines 9–11; add `merge_normalized` helper; `run()` loop lines ~139–144)

**Interfaces:**
- Consumes: `fetch_reddit_posts`, `fetch_arxiv_posts`, `fetch_github_posts` (Tasks 1–3); `subreddits`/`github_query`/`arxiv_query` config (Task 4).
- Produces: `merge_normalized(source_lists: list) -> list` — assigns each post an internal `_score` (0–1, relative to its source's max; flat `0.5` when the source's max is 0) and returns the merged list sorted by `_score` desc. `_score` is internal-only and never written to the DB (`insert_posts` builds an explicit dict).

- [ ] **Step 1: Add the three source imports**

In `gideon/fetch.py`, after the existing `from sources.lobsters import fetch_lobsters_posts` line, add:

```python
from sources.reddit import fetch_reddit_posts
from sources.arxiv import fetch_arxiv_posts
from sources.github import fetch_github_posts
```

- [ ] **Step 2: Add the `merge_normalized` helper**

In `gideon/fetch.py`, add this function immediately above `def run():`:

```python
def merge_normalized(source_lists: list) -> list:
    """Per source, normalize points to 0-1 relative to that source's own max, then
    merge and sort by the normalized score. A source whose max is 0 (e.g. arXiv) gets
    a flat 0.5 so it still competes instead of always sinking last under a raw-points
    sort. The `_score` key is internal-only; insert_posts builds an explicit row dict
    so it never reaches the DB."""
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

- [ ] **Step 3: Wire the new fetches and swap the sort in `run()`**

In `gideon/fetch.py`, replace this existing block:

```python
        hn_posts = fetch_hn_posts(config["hn_query"], config["hn_tags"])
        devto_posts = fetch_devto_posts(config["devto_tags"])
        lobsters_posts = fetch_lobsters_posts(config.get("lobsters_tags", []))

        all_posts = hn_posts + devto_posts + lobsters_posts
        all_posts.sort(key=lambda p: p.get("points", 0), reverse=True)
```

with:

```python
        hn_posts = fetch_hn_posts(config["hn_query"], config["hn_tags"])
        devto_posts = fetch_devto_posts(config["devto_tags"])
        lobsters_posts = fetch_lobsters_posts(config.get("lobsters_tags", []))
        reddit_posts = fetch_reddit_posts(config.get("subreddits", []))
        arxiv_posts = fetch_arxiv_posts(config.get("arxiv_query", ""))
        github_posts = fetch_github_posts(config.get("github_query", ""))

        all_posts = merge_normalized([
            hn_posts, devto_posts, lobsters_posts,
            reddit_posts, arxiv_posts, github_posts,
        ])
```

- [ ] **Step 4: Verify `merge_normalized` in isolation (pure, no network/DB)**

`fetch.py` reads Supabase env vars at import time, so set dummy values just to import. Run (PowerShell):

```powershell
$env:NEXT_PUBLIC_SUPABASE_URL='x'; $env:SUPABASE_SERVICE_ROLE_KEY='y'; python -c "import sys; sys.path.insert(0,'gideon'); from fetch import merge_normalized; out = merge_normalized([[{'points':100,'source':'a'},{'points':50,'source':'a'}], [{'points':0,'source':'arxiv'}], []]); print([(round(p['_score'],2), p['source']) for p in out])"
```

Expected: `[(1.0, 'a'), (0.5, 'arxiv'), (0.5, 'a')]` — the 100-pt 'a' normalizes to 1.0, the 0-pt arXiv gets the flat 0.5 (so it beats the 50-pt 'a' which is 0.5 too — tie, order stable), confirming arXiv competes instead of sinking.

- [ ] **Step 5: Commit**

```bash
git add gideon/fetch.py
git commit -m "feat(gideon): normalized cross-source merge + wire Reddit/arXiv/GitHub"
```

---

### Task 6: End-to-end run, docs, knowledge sync

**Files:**
- Modify: `.github/workflows/gideon.yml` (env block, lines ~28–34)
- Modify: `CLAUDE.md` (Gideon Agent section, line ~54)
- Modify: `.knowledge/arch-gideon.md`, `.knowledge/index.md`, `.knowledge/log.md` (via `/okf-sync`)

**Interfaces:**
- Consumes: everything from Tasks 1–5.

- [ ] **Step 0: Wire new secrets into the GitHub Actions workflow**

In `.github/workflows/gideon.yml`, inside the `Run Gideon` step's `env:` block (after the `GIDEON_PUSH_SECRET` line), add:

```yaml
          REDDIT_CLIENT_ID: ${{ secrets.REDDIT_CLIENT_ID }}
          REDDIT_CLIENT_SECRET: ${{ secrets.REDDIT_CLIENT_SECRET }}
          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

(`GITHUB_TOKEN` is auto-provided by Actions — no manual secret needed; it raises the GitHub search rate limit. `REDDIT_CLIENT_ID`/`REDDIT_CLIENT_SECRET` must be added manually in repo Settings → Secrets from a free Reddit "script" app at https://www.reddit.com/prefs/apps.) Commit: `git add .github/workflows/gideon.yml && git commit -m "ci(gideon): pass Reddit OAuth + GitHub token to cron"`

- [ ] **Step 1: Real end-to-end run against a non-prod / scratch Supabase**

Ensure `.env.local` (or shell env) has `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` for a **non-prod** project (or accept prod insert if intended). Optionally set `GITHUB_TOKEN`.

Run: `python gideon/fetch.py`
Expected: per-genre `Inserted N posts` lines, `Gideon done. Total inserted: M` with M > 0, and no traceback. Sources that rate-limit print a fetch error and contribute `[]` (fail-safe) — the run still completes.

- [ ] **Step 2: Confirm multiple sources actually landed**

Run: `python -c "import os; from supabase import create_client; c=create_client(os.environ['NEXT_PUBLIC_SUPABASE_URL'], os.environ['SUPABASE_SERVICE_ROLE_KEY']); r=c.table('posts').select('source').eq('is_gideon',True).execute(); from collections import Counter; print(Counter(x['source'] for x in r.data))"`
Expected: a `Counter` showing ≥ 3 distinct sources, ideally including `reddit` and `github` (and `arxiv` for AI-ish genres).

- [ ] **Step 3: Update CLAUDE.md Gideon section**

In `CLAUDE.md`, replace the Gideon paragraph (currently starting `Python cron at `gideon/` runs via GitHub Actions ... every 4 hours. Fetches from HN Algolia API + dev.to API + Lobsters ...`) with:

```markdown
Python cron at `gideon/` runs via GitHub Actions (`.github/workflows/gideon.yml`) every 6 hours. Fetches from 6 sources per genre — HN Algolia API, dev.to API, Lobsters (`gideon/sources/lobsters.py`), Reddit (`gideon/sources/reddit.py`, app-only OAuth via `oauth.reddit.com` per subreddit — the public `.json` host 403-blocks datacenter IPs), arXiv (`gideon/sources/arxiv.py`, newest papers, AI-ish genres only), and GitHub (`gideon/sources/github.py`, repo search by topic). Each source fails safe (returns `[]` on error). Posts are ranked by `merge_normalized` (per-source 0–1 score so big-number sources like GitHub/Reddit don't drown out arXiv), deduplicated by URL + normalized title, then up to `GIDEON_MAX_POSTS_PER_GENRE` (default 5) inserted with `is_gideon=true`. Requires `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` as GitHub Actions secrets; Reddit needs `REDDIT_CLIENT_ID` + `REDDIT_CLIENT_SECRET` (free "script" app — without them the Reddit source no-ops); `GITHUB_TOKEN` (auto-provided by Actions) raises the GitHub search rate limit.
```

- [ ] **Step 4: Commit docs**

```bash
git add CLAUDE.md
git commit -m "docs(gideon): document 6 sources + normalized ranking"
```

- [ ] **Step 5: Sync knowledge bundle**

Invoke `/okf-sync` (surgical): overwrite `.knowledge/arch-gideon.md` body to state **6 sources** (HN, dev.to, Lobsters, Reddit, arXiv, GitHub), the `merge_normalized` ranking, and restamp its timestamp to 2026-06-30; refresh its line in `.knowledge/index.md`; append a dated entry under today's heading in `.knowledge/log.md`.

- [ ] **Step 6: Final commit**

```bash
git add .knowledge/
git commit -m "docs(okf): Gideon now 6 sources with normalized ranking"
```

---

## Self-Review

**Spec coverage:**
- Reddit / arXiv / GitHub modules → Tasks 1, 2, 3 ✓
- genres.json config keys (subreddits all, github_query all, arxiv_query 4 genres) → Task 4 ✓
- `merge_normalized` (per-source 0–1, flat 0.5 on zero-max, internal `_score`, no DB change) → Task 5 ✓
- Fail-safe contract, no new deps, no schema change → enforced in module code + Global Constraints ✓
- Rate-limit handling (Reddit UA, optional GITHUB_TOKEN, fail-safe) → Tasks 1, 3 ✓
- Testing via `__main__` self-checks + real run (no pytest) → Steps in Tasks 1–3, 5–6 ✓
- Docs (CLAUDE.md + .knowledge) → Task 6 ✓
- X.com excluded → Global Constraints ✓

**Placeholder scan:** No TBD/TODO; all code blocks complete; exact config values present.

**Type consistency:** `fetch_reddit_posts(subreddits, limit)`, `fetch_arxiv_posts(query, limit)`, `fetch_github_posts(query, limit)`, `merge_normalized(source_lists)` — names/signatures identical between their defining task and their use in Task 5. Post-dict keys identical across all sources and consistent with existing `insert_posts` expectations (`title`, `url`, `content`, `image_url`, `points`, `source`). ✓
