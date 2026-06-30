# Gideon LLM-Judge Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add an LLM-as-judge quality gate to the Gideon content-seeding cron, configured entirely from the database and editable by an admin in-app.

**Architecture:** After Gideon ranks + dedups candidates per genre, an LLM (Gemini via its OpenAI-compatible endpoint) scores each one 0–10; only candidates scoring at/above a DB-configured threshold are inserted, walking down the ranked list until N pass (backfill). All judge config lives in a singleton DB table edited through a new admin page; Gideon reads it with the service-role client. The judge fails open — any failure falls back to today's ranked-top-N insert.

**Tech Stack:** Python 3 (`gideon/`, httpx, supabase-py, pytest), Postgres/Supabase (RLS + SECURITY DEFINER RPCs), Next.js 16 / React (admin page + route), Vitest.

## Global Constraints

- **Provider default is Gemini:** `base_url` defaults to `https://generativelanguage.googleapis.com/v1beta/openai/`, `model` defaults to `gemini-2.5-flash`. All three connection fields (key, base_url, model) are admin-editable so the provider is swappable without a code change.
- **Fail open everywhere:** no key / disabled / API error / malformed response ⇒ fall back to inserting the ranked top-N. The cron must never crash and the feed must never be blocked by the judge.
- **API key is write-only to the browser:** RPCs never return the raw `api_key`; the admin UI sees only `key_set` + `key_last4`. A blank key field on save keeps the existing key.
- **Supabase type-cast workaround:** every server-side query uses `(supabase as any).from(...)` / `(supabase as any).rpc(...)`. Project-wide, intentional — keep the casts.
- **Service-role bypasses RLS:** Gideon's `create_client(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)` bypasses RLS and reads the raw `api_key`. The table's RLS policies are admin-only and exist for the in-app (anon-key) path.
- **Migration is numbered `031`** and is applied to prod manually via the aws-1-ap-south-1 pooler (same as 024/025/030) — not in CI.
- **No new `posts.source` value** is introduced, so the `posts_source_check` CHECK (the 027/029 trap) is untouched.
- **Python tests run from the `gideon/` dir** via `python -m pytest tests/ -v` (the `python -m` form puts `gideon/` on `sys.path` so `import judge` / `import fetch` resolve).
- **Next.js 16:** dynamic route `params` is `Promise` — `await params`. (No dynamic params in this plan, noted for completeness.)

---

### Task 1: Migration 031 — `gideon_judge_config` table + RPCs

**Files:**
- Create: `supabase/migrations/031_gideon_judge_config.sql`

**Interfaces:**
- Consumes: `public.is_admin()` (migration 024), `public.users(id)`.
- Produces:
  - Table `public.gideon_judge_config` (singleton, `id = 1`): `enabled bool`, `api_key text`, `base_url text`, `model text`, `criteria text`, `pass_threshold int`, `updated_at`, `updated_by`.
  - RPC `gideon_judge_config_get() returns json` — masked config (no raw key; adds `key_set`, `key_last4`); `null` to non-admins.
  - RPC `gideon_judge_config_save(p_enabled boolean, p_base_url text, p_model text, p_criteria text, p_threshold int, p_api_key text) returns json` — updates the singleton (blank key preserved, threshold clamped 0–10), returns the masked config; `null` to non-admins.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/031_gideon_judge_config.sql`:

```sql
-- Gideon LLM-judge configuration.
--
-- A singleton row (id = 1) holding the connection + behavior of the quality
-- gate Gideon applies before inserting seeded posts. Stored in DB (not env) so
-- the founder can retune it live from /admin/gideon. The raw api_key never
-- leaves the server: the _get RPC returns only key_set + key_last4, and _save
-- keeps the existing key when handed a blank one. Gideon reads this table with
-- the service-role client, which bypasses RLS.

create table if not exists public.gideon_judge_config (
  id             int primary key default 1 check (id = 1),
  enabled        boolean not null default false,
  api_key        text,
  base_url       text not null default 'https://generativelanguage.googleapis.com/v1beta/openai/',
  model          text not null default 'gemini-2.5-flash',
  criteria       text not null default
    'You are a content curator for Await, a community for verified techies (developers, engineers, security researchers, data/AI practitioners). Decide whether a candidate link is worth posting to the feed. Favor: substantive technical content, notable tool/library releases, in-depth writeups, credible research. Reject: clickbait, low-effort listicles, marketing or PR fluff, generic news rehashes, off-topic or non-technical items, and anything unsafe or NSFW.',
  pass_threshold int not null default 6 check (pass_threshold between 0 and 10),
  updated_at     timestamptz not null default now(),
  updated_by     uuid references public.users(id)
);

-- Seed the single row (idempotent).
insert into public.gideon_judge_config (id) values (1) on conflict (id) do nothing;

alter table public.gideon_judge_config enable row level security;

drop policy if exists "Admins can read judge config" on public.gideon_judge_config;
create policy "Admins can read judge config"
  on public.gideon_judge_config for select
  using (public.is_admin());

drop policy if exists "Admins can update judge config" on public.gideon_judge_config;
create policy "Admins can update judge config"
  on public.gideon_judge_config for update
  using (public.is_admin()) with check (public.is_admin());

-- Read masked config (never the raw key). Admin-gated; null to everyone else.
create or replace function public.gideon_judge_config_get()
returns json
language sql security definer set search_path = public stable as $$
  select case when not public.is_admin() then null else (
    select json_build_object(
      'enabled', enabled,
      'base_url', base_url,
      'model', model,
      'criteria', criteria,
      'pass_threshold', pass_threshold,
      'key_set', (api_key is not null and length(api_key) > 0),
      'key_last4', case when api_key is not null and length(api_key) >= 4
                        then right(api_key, 4) else null end,
      'updated_at', updated_at
    ) from public.gideon_judge_config where id = 1
  ) end;
$$;

grant execute on function public.gideon_judge_config_get() to authenticated;

-- Save config. Blank p_api_key keeps the existing key; threshold clamped 0-10.
create or replace function public.gideon_judge_config_save(
  p_enabled   boolean,
  p_base_url  text,
  p_model     text,
  p_criteria  text,
  p_threshold int,
  p_api_key   text
) returns json
language plpgsql security definer set search_path = public volatile as $$
begin
  if not public.is_admin() then
    return null;
  end if;
  update public.gideon_judge_config set
    enabled        = coalesce(p_enabled, enabled),
    base_url       = coalesce(nullif(p_base_url, ''), base_url),
    model          = coalesce(nullif(p_model, ''), model),
    criteria       = coalesce(p_criteria, criteria),
    pass_threshold = greatest(0, least(10, coalesce(p_threshold, pass_threshold))),
    api_key        = case when p_api_key is null or p_api_key = '' then api_key else p_api_key end,
    updated_at     = now(),
    updated_by     = auth.uid()
  where id = 1;
  return public.gideon_judge_config_get();
end;
$$;

grant execute on function public.gideon_judge_config_save(boolean, text, text, text, int, text) to authenticated;
```

- [ ] **Step 2: Review the SQL against the constraints**

Read the file once and confirm:
- `id = 1` CHECK + `on conflict do nothing` ⇒ exactly one row, re-applying the migration is safe.
- `gideon_judge_config_get()` selects **no** `api_key` column, only `key_set` / `key_last4`.
- `gideon_judge_config_save` preserves the key on blank input (`case when p_api_key is null or p_api_key = '' then api_key else p_api_key end`).
- `pass_threshold` clamped via `greatest(0, least(10, ...))`.
- Both functions are `security definer set search_path = public` and gated by `public.is_admin()`.

Expected: all five hold. (This migration has no automated test — it is verified by review here and applied to prod during execution via the aws-1 pooler, like 024/025/030.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/031_gideon_judge_config.sql
git commit -m "feat(db): migration 031 — gideon_judge_config table + admin RPCs"
```

---

### Task 2: `gideon/judge.py` — judge core + backfill selector

**Files:**
- Create: `gideon/judge.py`
- Create: `gideon/tests/test_judge.py`
- Create: `gideon/requirements-dev.txt`

**Interfaces:**
- Consumes: a `config` dict shaped like a `gideon_judge_config` row: `{"enabled","api_key","base_url","model","criteria","pass_threshold", ...}`; `httpx` (already a dependency).
- Produces:
  - `load_config(supabase) -> dict | None` — reads the singleton row via the (service-role) client; `None` on any error.
  - `build_prompt(post: dict, criteria: str) -> str`.
  - `parse_verdict(content: str, threshold: int) -> tuple[bool, int, str]` — `(keep, score, reason)`; raises `ValueError`/`json`/`KeyError` on unparseable input.
  - `_call_llm(config: dict, prompt: str) -> str` — OpenAI-compatible `/chat/completions` call, returns the message content string.
  - `judge_post(post: dict, config: dict) -> tuple[bool, int, str]` — full judge of one post; fail-open `(True, -1, <reason>)` on any error.
  - `select_with_judge(candidates: list, max_n: int, judge_fn) -> list` — walk candidates, keep those `judge_fn` passes until `max_n` kept or pool exhausted (backfill).
  - Constant `JUDGE_FALLBACK_REASON: str`.

- [ ] **Step 1: Add the dev requirements file**

Create `gideon/requirements-dev.txt`:

```
pytest>=8,<9
```

- [ ] **Step 2: Install test deps**

Run: `cd gideon && python -m pip install -r requirements.txt -r requirements-dev.txt`
Expected: pytest + httpx + supabase installed (or "already satisfied").

- [ ] **Step 3: Write the failing tests**

Create `gideon/tests/test_judge.py`:

```python
import pytest
import judge


# --- parse_verdict ---

def test_parse_verdict_passes_at_threshold():
    keep, score, reason = judge.parse_verdict('{"score": 6, "reason": "solid"}', 6)
    assert keep is True
    assert score == 6
    assert reason == "solid"


def test_parse_verdict_fails_below_threshold():
    keep, score, reason = judge.parse_verdict('{"score": 5, "reason": "meh"}', 6)
    assert keep is False
    assert score == 5


def test_parse_verdict_extracts_fenced_json():
    content = 'Here is my verdict:\n```json\n{"score": 8, "reason": "great"}\n```'
    keep, score, reason = judge.parse_verdict(content, 6)
    assert keep is True
    assert score == 8


def test_parse_verdict_raises_on_no_json():
    with pytest.raises(ValueError):
        judge.parse_verdict("no json here", 6)


# --- judge_post (fail-open) ---

def test_judge_post_keeps_when_score_ge_threshold(monkeypatch):
    monkeypatch.setattr(judge, "_call_llm", lambda cfg, prompt: '{"score": 9, "reason": "ok"}')
    cfg = {"criteria": "c", "pass_threshold": 6, "base_url": "x", "model": "m", "api_key": "k"}
    keep, score, reason = judge.judge_post({"title": "T", "url": "u"}, cfg)
    assert keep is True
    assert score == 9


def test_judge_post_drops_when_below_threshold(monkeypatch):
    monkeypatch.setattr(judge, "_call_llm", lambda cfg, prompt: '{"score": 2, "reason": "weak"}')
    cfg = {"criteria": "c", "pass_threshold": 6, "base_url": "x", "model": "m", "api_key": "k"}
    keep, score, reason = judge.judge_post({"title": "T", "url": "u"}, cfg)
    assert keep is False
    assert score == 2


def test_judge_post_fail_open_on_call_error(monkeypatch):
    def boom(cfg, prompt):
        raise RuntimeError("network down")
    monkeypatch.setattr(judge, "_call_llm", boom)
    cfg = {"criteria": "c", "pass_threshold": 6, "base_url": "x", "model": "m", "api_key": "k"}
    keep, score, reason = judge.judge_post({"title": "T", "url": "u"}, cfg)
    assert keep is True
    assert score == -1
    assert reason == judge.JUDGE_FALLBACK_REASON


def test_judge_post_fail_open_on_bad_json(monkeypatch):
    monkeypatch.setattr(judge, "_call_llm", lambda cfg, prompt: "totally not json")
    cfg = {"criteria": "c", "pass_threshold": 6, "base_url": "x", "model": "m", "api_key": "k"}
    keep, score, reason = judge.judge_post({"title": "T", "url": "u"}, cfg)
    assert keep is True


# --- select_with_judge (backfill) ---

def test_select_with_judge_stops_at_n():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(10)]
    # every candidate passes
    kept = judge.select_with_judge(cands, 3, lambda c: (True, 9, "ok"))
    assert len(kept) == 3
    assert [c["title"] for c in kept] == ["p0", "p1", "p2"]


def test_select_with_judge_backfills_past_drops():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(6)]
    # drop the first two, keep the rest
    def jf(c):
        keep = c["title"] not in ("p0", "p1")
        return (keep, 9 if keep else 1, "x")
    kept = judge.select_with_judge(cands, 2, jf)
    assert [c["title"] for c in kept] == ["p2", "p3"]


def test_select_with_judge_exhausts_pool_when_few_pass():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(4)]
    # only p1 passes; pool exhausts before reaching N=3
    kept = judge.select_with_judge(cands, 3, lambda c: (c["title"] == "p1", 9, "x"))
    assert [c["title"] for c in kept] == ["p1"]
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd gideon && python -m pytest tests/test_judge.py -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'judge'` (module not yet created).

- [ ] **Step 5: Implement `gideon/judge.py`**

Create `gideon/judge.py`:

```python
"""LLM-as-judge quality gate for Gideon.

Scores candidate posts 0-10 via an OpenAI-compatible chat-completions endpoint
(Gemini by default). Configuration is read from the gideon_judge_config DB row.
Every failure path is fail-open: a candidate that can't be judged is kept, so
the judge never blocks the feed. See docs/superpowers/specs/2026-06-30-gideon-llm-judge-design.md.
"""
import json
import re
import httpx

JUDGE_FALLBACK_REASON = "judge-unavailable (fail-open)"


def load_config(supabase) -> dict | None:
    """Read the singleton gideon_judge_config row. Service-role client bypasses
    RLS, so the raw api_key comes back. Returns None on any error."""
    try:
        res = supabase.table("gideon_judge_config").select("*").eq("id", 1).single().execute()
        return res.data
    except Exception as e:
        print(f"  judge: config load failed: {e}")
        return None


def build_prompt(post: dict, criteria: str) -> str:
    title = post.get("title") or ""
    url = post.get("url") or ""
    excerpt = (post.get("content") or "")[:500]
    return (
        f"{criteria}\n\n"
        "Rate the item below for whether it is worth posting, on a 0-10 scale.\n"
        'Respond with ONLY a JSON object: {"score": <integer 0-10>, "reason": "<short>"}\n\n'
        f"Title: {title}\nURL: {url}\nExcerpt: {excerpt}"
    )


def parse_verdict(content: str, threshold: int) -> tuple[bool, int, str]:
    """Extract the first JSON object from the model output and turn it into a
    verdict. Raises if no JSON object is present or score is missing."""
    m = re.search(r"\{.*\}", content, re.DOTALL)
    if not m:
        raise ValueError("no JSON object in judge response")
    data = json.loads(m.group(0))
    score = int(data["score"])
    reason = str(data.get("reason", ""))[:200]
    return (score >= threshold, score, reason)


def _call_llm(config: dict, prompt: str) -> str:
    """One OpenAI-compatible /chat/completions request; returns message content."""
    url = config["base_url"].rstrip("/") + "/chat/completions"
    resp = httpx.post(
        url,
        headers={
            "Authorization": f"Bearer {config['api_key']}",
            "Content-Type": "application/json",
        },
        json={
            "model": config["model"],
            "messages": [{"role": "user", "content": prompt}],
            "temperature": 0,
        },
        timeout=30,
    )
    resp.raise_for_status()
    return resp.json()["choices"][0]["message"]["content"]


def judge_post(post: dict, config: dict) -> tuple[bool, int, str]:
    """Judge one post. Any error (network, HTTP, parse) fails open: keep=True."""
    threshold = int(config.get("pass_threshold", 6))
    try:
        prompt = build_prompt(post, config.get("criteria") or "")
        content = _call_llm(config, prompt)
        return parse_verdict(content, threshold)
    except Exception as e:
        print(f"  judge: error ({e}); failing open for {post.get('title')!r}")
        return (True, -1, JUDGE_FALLBACK_REASON)


def select_with_judge(candidates: list, max_n: int, judge_fn) -> list:
    """Walk candidates in ranked order, judging each; collect those that pass
    until max_n are kept or the pool is exhausted (backfill)."""
    kept: list = []
    for c in candidates:
        keep, score, reason = judge_fn(c)
        verdict = "KEEP" if keep else "DROP"
        print(f"  judge: {verdict} score={score} {c.get('title')!r} — {reason}")
        if keep:
            kept.append(c)
            if len(kept) >= max_n:
                break
    return kept
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd gideon && python -m pytest tests/test_judge.py -v`
Expected: PASS — all 10 tests green.

- [ ] **Step 7: Commit**

```bash
git add gideon/judge.py gideon/tests/test_judge.py gideon/requirements-dev.txt
git commit -m "feat(gideon): LLM-judge core (judge_post, parse_verdict, backfill selector)"
```

---

### Task 3: Wire the judge into `gideon/fetch.py`

**Files:**
- Modify: `gideon/fetch.py` (env reads ~18-22; `insert_posts` 77-120; `run` 148-179)
- Create: `gideon/tests/test_fetch.py`

**Interfaces:**
- Consumes: `judge.load_config`, `judge.judge_post`, `judge.select_with_judge` (Task 2); existing `slugify`, `fetch_og_image`, `merge_normalized`, `MAX_POSTS_PER_GENRE`.
- Produces:
  - `dedup_candidates(posts: list, existing_urls: set, existing_title_keys: set) -> list` — returns candidates with a title+url, skipping URL dupes and same-title dupes; mutates the two sets as it goes.
  - `insert_records(supabase, posts: list, genre: str) -> tuple[int, list]` — inserts the given (already selected) posts, returns `(count, new_post_records)`.
  - `insert_posts` is **replaced** by the `dedup_candidates` → `select_with_judge`/slice → `insert_records` pipeline in `run()`.

- [ ] **Step 1: Write the failing tests**

Create `gideon/tests/test_fetch.py`:

```python
import fetch


def test_dedup_candidates_skips_missing_fields():
    posts = [
        {"title": "", "url": "u1"},
        {"title": "Has title", "url": ""},
        {"title": "Good", "url": "u3"},
    ]
    out = fetch.dedup_candidates(posts, set(), set())
    assert [p["url"] for p in out] == ["u3"]


def test_dedup_candidates_skips_url_dupes():
    posts = [{"title": "A", "url": "u1"}, {"title": "B", "url": "u1"}]
    out = fetch.dedup_candidates(posts, set(), set())
    assert len(out) == 1
    assert out[0]["title"] == "A"


def test_dedup_candidates_skips_same_title():
    posts = [{"title": "Same Title", "url": "u1"}, {"title": "same title", "url": "u2"}]
    out = fetch.dedup_candidates(posts, set(), set())
    assert len(out) == 1


def test_dedup_candidates_respects_existing_sets():
    posts = [{"title": "A", "url": "u1"}, {"title": "B", "url": "u2"}]
    out = fetch.dedup_candidates(posts, {"u1"}, set())
    assert [p["url"] for p in out] == ["u2"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd gideon && python -m pytest tests/test_fetch.py -v`
Expected: FAIL — `AttributeError: module 'fetch' has no attribute 'dedup_candidates'` (or import error from env, fixed in Step 3).

- [ ] **Step 3: Make module-level env reads import-safe**

In `gideon/fetch.py`, change the two required-env reads (lines 18-19) from `os.environ[...]` to `os.environ.get(...)` so importing `fetch` in tests doesn't raise. Add the `judge` imports.

Replace:

```python
SUPABASE_URL = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
```

with:

```python
SUPABASE_URL = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
SUPABASE_KEY = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
```

And add to the import block (after the `from sources.github ...` line):

```python
from judge import load_config, judge_post, select_with_judge
```

- [ ] **Step 4: Replace `insert_posts` with `dedup_candidates` + `insert_records`**

In `gideon/fetch.py`, delete the entire `insert_posts` function (lines 77-120) and replace it with:

```python
def dedup_candidates(posts: list, existing_urls: set, existing_title_keys: set) -> list:
    """Filter candidates to those with a title+url that aren't URL dupes or
    same-title near-dupes (within the batch and against what's already stored).
    Mutates the two sets so later candidates see earlier ones."""
    unique: list = []
    for post in posts:
        if not post.get("title") or not post.get("url"):
            continue
        if post["url"] in existing_urls:
            continue
        title_key = slugify(post["title"])
        if title_key in existing_title_keys:
            continue
        existing_urls.add(post["url"])
        existing_title_keys.add(title_key)
        unique.append(post)
    return unique


def insert_records(supabase: Client, posts: list, genre: str) -> tuple[int, list]:
    """Insert already-selected posts (dedup + judging done upstream). Returns
    (count, new_post_records) where each record is {"id","title","genre"} for push."""
    inserted = 0
    new_post_records: list = []
    for post in posts:
        image_url = post.get("image_url") or fetch_og_image(post.get("url"))
        result = supabase.table("posts").insert({
            "is_gideon": True,
            "title": post["title"],
            "slug": unique_slug(supabase, post["title"]),
            "url": post["url"],
            "content": post.get("content") or None,
            "image_url": image_url,
            "genre": genre,
            "source": post["source"],
            "author_id": None,
        }).execute()
        inserted += 1
        if result.data and len(result.data) > 0:
            row_id = result.data[0].get("id")
            if row_id:
                new_post_records.append({"id": row_id, "title": post["title"], "genre": genre})
    return inserted, new_post_records
```

- [ ] **Step 5: Wire judge config + the pipeline into `run()`**

In `gideon/fetch.py` `run()`, after `genres = load_genres()` add the config load + active flag:

```python
def run():
    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    genres = load_genres()
    total = 0
    all_new_posts: list = []

    # Load the LLM-judge config once. Active only when enabled AND a key is set;
    # otherwise we fall back to ranked-top-N insert (fail open).
    judge_config = load_config(supabase)
    judge_active = bool(judge_config and judge_config.get("enabled"))
    if judge_active and not judge_config.get("api_key"):
        print("  judge: enabled but no api_key set — inserting unjudged (fail open)")
        judge_active = False
    print(f"  judge: {'ACTIVE' if judge_active else 'inactive'}")

    if os.environ.get("GIDEON_RESET", "").lower() in ("1", "true", "yes"):
        reset_gideon_posts(supabase)
```

Then replace the per-genre insert block (the old `all_posts = merge_normalized([...])` → `insert_posts(...)` section) with:

```python
        all_posts = merge_normalized([
            hn_posts, devto_posts, lobsters_posts,
            reddit_posts, arxiv_posts, github_posts,
        ])

        unique = dedup_candidates(all_posts, existing_urls, existing_title_keys)
        if judge_active:
            selected = select_with_judge(
                unique, MAX_POSTS_PER_GENRE, lambda c: judge_post(c, judge_config)
            )
        else:
            selected = unique[:MAX_POSTS_PER_GENRE]

        inserted, new_post_records = insert_records(supabase, selected, genre_id)
        print(f"  Inserted {inserted} posts for {genre_id}")
        total += inserted
        all_new_posts.extend(new_post_records)
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd gideon && python -m pytest tests/ -v`
Expected: PASS — `test_fetch.py` (4) + `test_judge.py` (10) all green.

- [ ] **Step 7: Commit**

```bash
git add gideon/fetch.py gideon/tests/test_fetch.py
git commit -m "feat(gideon): apply LLM-judge gate in fetch pipeline (dedup → judge → insert)"
```

---

### Task 4: Admin config input parser

**Files:**
- Create: `lib/admin/judgeConfig.ts`
- Create: `tests/lib/admin/judgeConfig.test.ts`

**Interfaces:**
- Produces:
  - Type `JudgeConfigInput = { enabled: boolean; base_url: string; model: string; criteria: string; pass_threshold: number; api_key: string }`.
  - `parseJudgeConfigInput(body: unknown): { ok: true; value: JudgeConfigInput } | { ok: false; error: string }` — coerces/validates the POST body; clamps `pass_threshold` to 0–10; treats a missing/blank `api_key` as `''` (meaning "keep existing key" downstream).

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/admin/judgeConfig.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseJudgeConfigInput } from '@/lib/admin/judgeConfig'

describe('parseJudgeConfigInput', () => {
  it('accepts a full valid body', () => {
    const r = parseJudgeConfigInput({
      enabled: true, base_url: 'https://x/', model: 'gemini-2.5-flash',
      criteria: 'be good', pass_threshold: 7, api_key: 'AIzaSECRET',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.enabled).toBe(true)
      expect(r.value.pass_threshold).toBe(7)
      expect(r.value.api_key).toBe('AIzaSECRET')
    }
  })

  it('clamps pass_threshold above 10 down to 10', () => {
    const r = parseJudgeConfigInput({ enabled: false, pass_threshold: 99 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.pass_threshold).toBe(10)
  })

  it('clamps negative pass_threshold up to 0', () => {
    const r = parseJudgeConfigInput({ enabled: false, pass_threshold: -3 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.pass_threshold).toBe(0)
  })

  it('treats a missing api_key as empty string (keep existing)', () => {
    const r = parseJudgeConfigInput({ enabled: true })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.api_key).toBe('')
  })

  it('coerces enabled to a boolean', () => {
    const r = parseJudgeConfigInput({ enabled: 'on' as unknown })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.enabled).toBe(true)
  })

  it('rejects a non-object body', () => {
    const r = parseJudgeConfigInput(null)
    expect(r.ok).toBe(false)
  })

  it('rejects a non-numeric pass_threshold', () => {
    const r = parseJudgeConfigInput({ enabled: true, pass_threshold: 'high' })
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/admin/judgeConfig.test.ts`
Expected: FAIL — cannot resolve `@/lib/admin/judgeConfig`.

- [ ] **Step 3: Implement the parser**

Create `lib/admin/judgeConfig.ts`:

```ts
// Validates/normalizes the POST body for the Gideon judge admin form before it
// reaches the gideon_judge_config_save RPC. Pure (no Supabase) so it unit-tests
// without mocks. A blank api_key is intentional — the RPC keeps the existing key.
export type JudgeConfigInput = {
  enabled: boolean
  base_url: string
  model: string
  criteria: string
  pass_threshold: number
  api_key: string
}

type Result =
  | { ok: true; value: JudgeConfigInput }
  | { ok: false; error: string }

export function parseJudgeConfigInput(body: unknown): Result {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be an object' }
  }
  const b = body as Record<string, unknown>

  // pass_threshold: required to be numeric when present; clamp to 0..10.
  let threshold = 6
  if (b.pass_threshold !== undefined && b.pass_threshold !== null) {
    const n = Number(b.pass_threshold)
    if (!Number.isFinite(n)) return { ok: false, error: 'pass_threshold must be a number' }
    threshold = Math.max(0, Math.min(10, Math.round(n)))
  }

  return {
    ok: true,
    value: {
      enabled: Boolean(b.enabled),
      base_url: typeof b.base_url === 'string' ? b.base_url.trim() : '',
      model: typeof b.model === 'string' ? b.model.trim() : '',
      criteria: typeof b.criteria === 'string' ? b.criteria : '',
      pass_threshold: threshold,
      api_key: typeof b.api_key === 'string' ? b.api_key.trim() : '',
    },
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/admin/judgeConfig.test.ts`
Expected: PASS — all 7 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/judgeConfig.ts tests/lib/admin/judgeConfig.test.ts
git commit -m "feat(admin): judge-config input parser + tests"
```

---

### Task 5: Admin API route, page, form, and profile link

**Files:**
- Create: `app/api/admin/judge/route.ts`
- Create: `app/(app)/admin/gideon/page.tsx`
- Create: `components/admin/JudgeConfigForm.tsx`
- Modify: `app/(app)/profile/page.tsx:168-183` (Admin section)

**Interfaces:**
- Consumes: `parseJudgeConfigInput` (Task 4); RPCs `gideon_judge_config_get` / `gideon_judge_config_save` (Task 1); `is_admin` RPC; `@/lib/supabase/server::createClient`.
- Produces: `POST /api/admin/judge` → `{ config }` (masked) on success; the `/admin/gideon` page; a "🤖 Gideon judge" profile link.

- [ ] **Step 1: Implement the API route**

Create `app/api/admin/judge/route.ts` (mirrors `app/api/admin/reports/[id]/route.ts`'s auth gate):

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJudgeConfigInput } from '@/lib/admin/judgeConfig'

// POST /api/admin/judge — save the Gideon judge config. Admin-only; the
// gideon_judge_config_save RPC re-checks is_admin() and is the real guard.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: isAdmin } = await (supabase as any).rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseJudgeConfigInput(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const v = parsed.value
  const { data, error } = await (supabase as any).rpc('gideon_judge_config_save', {
    p_enabled: v.enabled,
    p_base_url: v.base_url,
    p_model: v.model,
    p_criteria: v.criteria,
    p_threshold: v.pass_threshold,
    p_api_key: v.api_key,   // '' ⇒ RPC keeps the existing key
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ config: data })
}
```

- [ ] **Step 2: Implement the client form**

Create `components/admin/JudgeConfigForm.tsx`:

```tsx
'use client'

import { useState } from 'react'

type MaskedConfig = {
  enabled: boolean
  base_url: string
  model: string
  criteria: string
  pass_threshold: number
  key_set: boolean
  key_last4: string | null
}

export function JudgeConfigForm({ initial }: { initial: MaskedConfig }) {
  const [enabled, setEnabled] = useState(initial.enabled)
  const [baseUrl, setBaseUrl] = useState(initial.base_url)
  const [model, setModel] = useState(initial.model)
  const [criteria, setCriteria] = useState(initial.criteria)
  const [threshold, setThreshold] = useState(initial.pass_threshold)
  const [apiKey, setApiKey] = useState('')
  const [keySet, setKeySet] = useState(initial.key_set)
  const [keyLast4, setKeyLast4] = useState(initial.key_last4)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  const save = async () => {
    setSaving(true); setMsg(null)
    try {
      const res = await fetch('/api/admin/judge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          enabled, base_url: baseUrl, model, criteria,
          pass_threshold: threshold, api_key: apiKey,
        }),
      })
      const json = await res.json()
      if (!res.ok) { setMsg(json.error || 'Save failed'); return }
      const c = json.config as MaskedConfig
      setEnabled(c.enabled); setBaseUrl(c.base_url); setModel(c.model)
      setCriteria(c.criteria); setThreshold(c.pass_threshold)
      setKeySet(c.key_set); setKeyLast4(c.key_last4)
      setApiKey('')
      setMsg('Saved.')
    } catch {
      setMsg('Save failed')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <label className="card p-4 flex items-center justify-between">
        <span className="text-ink font-medium">Judge enabled</span>
        <input type="checkbox" checked={enabled} onChange={e => setEnabled(e.target.checked)} />
      </label>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">API key</label>
        <input type="password" value={apiKey} onChange={e => setApiKey(e.target.value)}
          placeholder={keySet ? `•••• ${keyLast4 ?? ''} — set (blank keeps it)` : 'not set'}
          className="w-full bg-transparent border border-line rounded px-3 py-2 text-ink" />
      </div>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">Base URL</label>
        <input value={baseUrl} onChange={e => setBaseUrl(e.target.value)}
          className="w-full bg-transparent border border-line rounded px-3 py-2 text-ink" />
      </div>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">Model</label>
        <input value={model} onChange={e => setModel(e.target.value)}
          className="w-full bg-transparent border border-line rounded px-3 py-2 text-ink" />
      </div>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">
          Pass threshold ({threshold}/10)
        </label>
        <input type="range" min={0} max={10} value={threshold}
          onChange={e => setThreshold(Number(e.target.value))} className="w-full" />
      </div>

      <div className="card p-4 space-y-1.5">
        <label className="text-ink-faint text-xs uppercase tracking-widest">Criteria</label>
        <textarea value={criteria} onChange={e => setCriteria(e.target.value)} rows={6}
          className="w-full bg-transparent border border-line rounded px-3 py-2 text-ink text-sm" />
      </div>

      <div className="flex items-center gap-3">
        <button onClick={save} disabled={saving} className="btn btn-primary">
          {saving ? 'Saving…' : 'Save'}
        </button>
        {msg && <span className="text-ink-faint text-sm">{msg}</span>}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Implement the admin page**

Create `app/(app)/admin/gideon/page.tsx` (gate mirrors `app/(app)/admin/metrics/page.tsx`):

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { JudgeConfigForm } from '@/components/admin/JudgeConfigForm'

// Founder-only. Edits the gideon_judge_config singleton through admin RPCs.
// The raw API key is never sent to the browser — only key_set + key_last4.
export default async function AdminGideonPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/feed')

  const { data: config } = await (supabase as any).rpc('gideon_judge_config_get')

  if (!config) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-7">
        <p className="text-ink-faint">Judge config unavailable.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-7 space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink leading-none">Gideon judge</h1>
        <p className="text-ink-faint text-sm mt-1.5">
          LLM quality gate for seeded posts. Defaults to Gemini. When off, Gideon inserts
          the ranked top picks unfiltered.
        </p>
      </div>
      <JudgeConfigForm initial={config} />
    </div>
  )
}
```

- [ ] **Step 4: Add the profile link**

In `app/(app)/profile/page.tsx`, inside the Admin section's `<div className="space-y-1">` (after the Metrics `<Link>`, before the closing `</div>`), add:

```tsx
            <Link href="/admin/gideon" className="card p-4 flex items-center justify-between hover:border-clay transition-colors">
              <span className="text-ink font-medium flex items-center gap-2">🤖 Gideon judge</span>
              <span className="text-ink-faint">›</span>
            </Link>
```

- [ ] **Step 5: Verify the build/lint and the full JS test suite**

Run: `npm run lint && npx vitest run`
Expected: lint clean; all tests pass (including `tests/lib/admin/judgeConfig.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/judge/route.ts "app/(app)/admin/gideon/page.tsx" components/admin/JudgeConfigForm.tsx "app/(app)/profile/page.tsx"
git commit -m "feat(admin): /admin/gideon judge-config page, route, form + profile link"
```

---

### Task 6: Documentation & OKF sync

**Files:**
- Modify: `.knowledge/arch-gideon.md`
- Modify: `.knowledge/arch-database.md`
- Modify: `.knowledge/arch-moderation.md`
- Modify: `.knowledge/index.md`
- Modify: `.knowledge/log.md`

**Interfaces:** none (docs only).

- [ ] **Step 1: Update `arch-gideon.md`**

Add a section describing the judge gate: after `merge_normalized` + `dedup_candidates`, `select_with_judge` scores candidates 0–10 via an OpenAI-compatible endpoint (Gemini default) and keeps those ≥ `pass_threshold`, backfilling down the ranked list until `MAX_POSTS_PER_GENRE` pass. Config in `gideon_judge_config` (DB, admin-edited); fail-open at every step (no key/disabled/error ⇒ ranked-top-N). New files `gideon/judge.py`, `gideon/tests/`. Restamp `timestamp` to `2026-06-30`.

- [ ] **Step 2: Update `arch-database.md`**

Bump the migration range to `001–031`; add a `031_gideon_judge_config` bullet (singleton table, `is_admin()`-gated RLS + `gideon_judge_config_get`/`_save` RPCs, write-only key via `key_set`/`key_last4`, Gideon reads it with the service-role client). Restamp.

- [ ] **Step 3: Update `arch-moderation.md`**

Add `/admin/gideon` to the admin entry points (profile-page link "🤖 Gideon judge"), one line describing the judge-config page. Restamp.

- [ ] **Step 4: Update `index.md`**

Refresh the Gideon and Database concept lines to mention the LLM-judge gate / migration 031. Add an open-thread note: the judge is disabled by default until an admin sets a Gemini key at `/admin/gideon`.

- [ ] **Step 5: Append a dated `log.md` entry**

Under today's `## 2026-06-30` heading (newest-first), add an entry: "Gideon LLM-judge gate — `gideon_judge_config` (migration 031) + `judge.py` + `/admin/gideon`; Gemini default, fail-open, write-only key."

- [ ] **Step 6: Commit**

```bash
git add .knowledge/
git commit -m "docs(okf): record Gideon LLM-judge gate (judge.py, migration 031, /admin/gideon)"
```

---

## Notes for the executor

- **Migration 031 is NOT auto-applied.** After Task 1 (or at the end), apply it to prod via the aws-1-ap-south-1 pooler the same way 030 was — through a throwaway script run with the `!` prefix (the harness blocks autonomous prod-DB writes). The DB password is held only in that throwaway script, never committed.
- **The judge ships disabled.** Nothing changes in prod behavior until an admin opens `/admin/gideon`, pastes a Google AI Studio key, and toggles it on.
- **No APK rebuild needed** — this is web/server/DB/cron only; the Capacitor shell loads the live Vercel URL.
- **Manual prod check after enabling:** save with a blank key after setting one, confirm the key is preserved (the `gideon_judge_config_save` blank-key branch); then run the Gideon workflow and read the Actions log for `judge: ACTIVE` and `KEEP/DROP` lines.
```
