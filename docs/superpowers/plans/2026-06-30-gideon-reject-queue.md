# Gideon Reject Queue with Admin Override Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Record every post the Gideon judge rejects (score + reason) in an admin-only queue where the founder can Approve it into the feed or Delete it permanently.

**Architecture:** The judge (Python cron) writes its DROPs to a new `gideon_rejections` table; a permanent Delete tombstones the URL in `gideon_dismissed_urls` so Gideon never re-queues or re-posts it; un-actioned rejects auto-expire after 14 days. A new admin page lists rejects and calls SECURITY DEFINER RPCs to approve (insert into `posts`) or dismiss (tombstone + remove).

**Tech Stack:** Python 3 (`gideon/`, pytest), Postgres/Supabase (RLS + SECURITY DEFINER RPCs), Next.js 16 / React (admin page + route), Vitest.

## Global Constraints

- **Rejects-only, post-hoc:** judge KEEPs auto-publish unchanged; only DROPs are queued. Override is one-directional (approve a reject into the feed, or delete it). Live posts are never touched.
- **Delete is permanent (tombstone):** a deleted URL goes into `gideon_dismissed_urls` and is excluded from BOTH the feed path and the reject path on all future runs. Expiry (14d) does NOT tombstone — only an explicit Delete does.
- **Retention:** un-actioned rejects auto-expire after **14 days** (`created_at < now() - interval '14 days'`).
- **Rejects captured only when the judge is enabled** (`judge_active`). With the judge off, top-N publishes as before and `dropped` is empty.
- **`select_with_judge` only captures DROPs it made during the backfill walk** — candidates never reached (quota filled) are not rejections.
- **Supabase type-cast workaround (project-wide):** every server-side Supabase call uses `(supabase as any).from(...)` / `(supabase as any).rpc(...)`. Keep the casts.
- **Service-role bypasses RLS:** Gideon reads/writes these tables with the service-role client. The RLS policies are for the app (anon-key) path.
- **No new `posts.source` value** (approve reuses the candidate's original source) — `posts_source_check` is untouched.
- **Migration is numbered `032`**, applied to prod manually via the aws-1 pooler (like 031).
- **Python tests run from `gideon/`** via `python -m pytest tests/ -v`.
- **Next.js 16:** dynamic route `params` is `Promise` — `await params` in the route handler.

---

### Task 1: Migration 032 — `gideon_rejections` + `gideon_dismissed_urls` + RPCs

**Files:**
- Create: `supabase/migrations/032_gideon_reject_queue.sql`

**Interfaces:**
- Consumes: `public.is_admin()` (migration 024), `public.posts`, `gen_random_uuid()`.
- Produces:
  - Table `public.gideon_rejections(id uuid pk, title, url unique, content, image_url, genre, source, score int, reason, created_at)`.
  - Table `public.gideon_dismissed_urls(url text pk, created_at)`.
  - RPC `gideon_approve_rejection(p_id uuid) returns uuid` — inserts the reject into `posts` (generated unique slug), deletes the reject; null to non-admins.
  - RPC `gideon_dismiss_rejection(p_id uuid) returns boolean` — tombstones the URL, deletes the reject; null to non-admins.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/032_gideon_reject_queue.sql`:

```sql
-- Gideon reject queue + tombstones.
--
-- When the LLM judge (migration 031) DROPs a candidate, Gideon records it here
-- so the founder can review it at /admin/gideon/rejections and either Approve
-- (promote into posts) or Delete (permanent — tombstone the URL so it never
-- re-surfaces). Un-actioned rejects auto-expire after 14 days (purge runs in
-- the cron). Gideon reads/writes via the service-role client (bypasses RLS).

create table if not exists public.gideon_rejections (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  url        text not null unique,
  content    text,
  image_url  text,
  genre      text not null,
  source     text not null,
  score      int  not null,
  reason     text,
  created_at timestamptz not null default now()
);

create index if not exists gideon_rejections_created_idx
  on public.gideon_rejections(created_at desc);

create table if not exists public.gideon_dismissed_urls (
  url        text primary key,
  created_at timestamptz not null default now()
);

alter table public.gideon_rejections enable row level security;
alter table public.gideon_dismissed_urls enable row level security;

-- Admins read the queue directly (no secrets in a reject row). Mutations go
-- through the SECURITY DEFINER RPCs below, so no insert/update/delete policy.
drop policy if exists "Admins read rejections" on public.gideon_rejections;
create policy "Admins read rejections"
  on public.gideon_rejections for select
  using (public.is_admin());

drop policy if exists "Admins read dismissed" on public.gideon_dismissed_urls;
create policy "Admins read dismissed"
  on public.gideon_dismissed_urls for select
  using (public.is_admin());

-- Approve: move a reject into the feed. Generates a unique slug the same way
-- gideon/fetch.py does (lowercase, non-alphanumerics -> '-', trim, cap 60;
-- random 6-char suffix on collision). Returns the new post id; null if not admin.
create or replace function public.gideon_approve_rejection(p_id uuid)
returns uuid
language plpgsql security definer set search_path = public volatile as $$
declare
  r      public.gideon_rejections%rowtype;
  v_slug text;
  v_id   uuid;
begin
  if not public.is_admin() then
    return null;
  end if;

  select * into r from public.gideon_rejections where id = p_id;
  if not found then
    return null;
  end if;

  v_slug := nullif(
    trim(both '-' from substr(regexp_replace(lower(coalesce(r.title, '')), '[^a-z0-9]+', '-', 'g'), 1, 60)),
    ''
  );
  v_slug := coalesce(v_slug, 'post');
  if exists (select 1 from public.posts where slug = v_slug) then
    v_slug := v_slug || '-' || substr(md5(gen_random_uuid()::text), 1, 6);
  end if;

  insert into public.posts (is_gideon, title, slug, url, content, image_url, genre, source, author_id)
  values (true, r.title, v_slug, r.url, r.content, r.image_url, r.genre, r.source, null)
  returning id into v_id;

  delete from public.gideon_rejections where id = p_id;
  return v_id;
end;
$$;

grant execute on function public.gideon_approve_rejection(uuid) to authenticated;

-- Dismiss: permanently kill a reject. Tombstones the URL and removes the row.
create or replace function public.gideon_dismiss_rejection(p_id uuid)
returns boolean
language plpgsql security definer set search_path = public volatile as $$
declare
  v_url text;
begin
  if not public.is_admin() then
    return null;
  end if;

  select url into v_url from public.gideon_rejections where id = p_id;
  if not found then
    return false;
  end if;

  insert into public.gideon_dismissed_urls (url) values (v_url) on conflict (url) do nothing;
  delete from public.gideon_rejections where id = p_id;
  return true;
end;
$$;

grant execute on function public.gideon_dismiss_rejection(uuid) to authenticated;
```

- [ ] **Step 2: Review the SQL**

Read the file and confirm: `url` is unique on `gideon_rejections`; both tables have RLS enabled with admin-only SELECT; both RPCs are `security definer set search_path = public`, `is_admin()`-gated, granted to `authenticated`; approve inserts into `posts` with `author_id=null`/`is_gideon=true` and a collision-suffixed slug; dismiss tombstones then deletes. Idempotent (`if not exists`, `or replace`, `drop policy if exists`). No automated test for SQL — verified by review + manual prod apply.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/032_gideon_reject_queue.sql
git commit -m "feat(db): migration 032 — gideon reject queue + tombstones + approve/dismiss RPCs"
```

---

### Task 2: `select_with_judge` returns dropped candidates

**Files:**
- Modify: `gideon/judge.py:82-94` (`select_with_judge`)
- Modify: `gideon/tests/test_judge.py:70-92` (the three existing `select_with_judge` tests) + add two tests

**Interfaces:**
- Produces: `select_with_judge(candidates, max_n, judge_fn) -> tuple[list, list]` — `(kept, dropped)` where `dropped` is a list of `{"post": dict, "score": int, "reason": str}` for candidates the judge scored below threshold **during the walk** (not candidates skipped after the quota filled).

- [ ] **Step 1: Update the existing tests to the new return shape and add coverage**

In `gideon/tests/test_judge.py`, replace the three existing `select_with_judge` tests (lines 70-92) with these five:

```python
# --- select_with_judge (backfill + dropped capture) ---

def test_select_with_judge_stops_at_n():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(10)]
    kept, dropped = judge.select_with_judge(cands, 3, lambda c: (True, 9, "ok"))
    assert [c["title"] for c in kept] == ["p0", "p1", "p2"]
    assert dropped == []


def test_select_with_judge_backfills_past_drops():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(6)]
    def jf(c):
        keep = c["title"] not in ("p0", "p1")
        return (keep, 9 if keep else 1, "x")
    kept, dropped = judge.select_with_judge(cands, 2, jf)
    assert [c["title"] for c in kept] == ["p2", "p3"]
    assert [d["post"]["title"] for d in dropped] == ["p0", "p1"]


def test_select_with_judge_exhausts_pool_when_few_pass():
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(4)]
    kept, dropped = judge.select_with_judge(cands, 3, lambda c: (c["title"] == "p1", 9, "x"))
    assert [c["title"] for c in kept] == ["p1"]
    assert [d["post"]["title"] for d in dropped] == ["p0", "p2", "p3"]


def test_select_with_judge_dropped_carries_score_and_reason():
    cands = [{"title": "p0", "url": "u0"}]
    kept, dropped = judge.select_with_judge(cands, 5, lambda c: (False, 2, "weak"))
    assert kept == []
    assert dropped == [{"post": {"title": "p0", "url": "u0"}, "score": 2, "reason": "weak"}]


def test_select_with_judge_does_not_capture_unreached_candidates():
    # quota of 2 fills at p2; p3 is never judged, so it is NOT a drop.
    cands = [{"title": f"p{i}", "url": f"u{i}"} for i in range(4)]
    seq = {"p0": True, "p1": False, "p2": True, "p3": True}
    kept, dropped = judge.select_with_judge(
        cands, 2, lambda c: (seq[c["title"]], 9 if seq[c["title"]] else 1, "r")
    )
    assert [c["title"] for c in kept] == ["p0", "p2"]
    assert [d["post"]["title"] for d in dropped] == ["p1"]
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd gideon && python -m pytest tests/test_judge.py -v`
Expected: FAIL — the tests now unpack `kept, dropped` but `select_with_judge` still returns a single list (`ValueError`/`TypeError` on unpack, or the dropped assertions fail).

- [ ] **Step 3: Update `select_with_judge`**

In `gideon/judge.py`, replace the function (lines 82-94) with:

```python
def select_with_judge(candidates: list, max_n: int, judge_fn) -> tuple[list, list]:
    """Walk candidates in ranked order, judging each; collect those that pass
    until max_n are kept or the pool is exhausted (backfill). Returns
    (kept, dropped); dropped is a list of {"post", "score", "reason"} for the
    candidates judged-and-dropped during the walk (not those skipped after the
    quota filled)."""
    kept: list = []
    dropped: list = []
    for c in candidates:
        keep, score, reason = judge_fn(c)
        verdict = "KEEP" if keep else "DROP"
        print(f"  judge: {verdict} score={score} {c.get('title')!r} — {reason}")
        if keep:
            kept.append(c)
            if len(kept) >= max_n:
                break
        else:
            dropped.append({"post": c, "score": score, "reason": reason})
    return kept, dropped
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd gideon && python -m pytest tests/test_judge.py -v`
Expected: PASS — all `test_judge.py` tests green (the `parse_verdict` / `judge_post` tests are unaffected).

- [ ] **Step 5: Commit**

```bash
git add gideon/judge.py gideon/tests/test_judge.py
git commit -m "feat(gideon): select_with_judge returns dropped candidates with score+reason"
```

---

### Task 3: Reject-queue plumbing in `gideon/fetch.py`

**Files:**
- Modify: `gideon/fetch.py` (imports line 1-15; `dedup_candidates` 78-94; `run` 148-195)
- Modify: `gideon/tests/test_fetch.py` (add tests)

**Interfaces:**
- Consumes: `judge.select_with_judge -> (kept, dropped)` (Task 2); the migration-032 tables (Task 1).
- Produces:
  - `dedup_candidates(posts, existing_urls, existing_title_keys, dismissed=None) -> list` — now also skips URLs in `dismissed`.
  - `load_dismissed_urls(supabase) -> set`, `load_queued_reject_urls(supabase) -> set`, `load_live_gideon_urls(supabase) -> set`.
  - `filter_new_rejections(dropped, skip_urls) -> list` — pure; returns dropped entries whose URL isn't already in `skip_urls`, deduped within the batch, mutating `skip_urls`. (`skip_urls` is seeded with both queued-reject URLs and live-post URLs.)
  - `record_rejections(supabase, dropped, genre, skip_urls) -> int` — inserts the filtered rejects.
  - `purge_expired_rejections(supabase) -> None`.

- [ ] **Step 1: Write the failing tests**

In `gideon/tests/test_fetch.py`, append:

```python
def test_dedup_candidates_excludes_dismissed():
    posts = [{"title": "A", "url": "u1"}, {"title": "B", "url": "u2"}]
    out = fetch.dedup_candidates(posts, set(), set(), {"u1"})
    assert [p["url"] for p in out] == ["u2"]


def test_dedup_candidates_dismissed_defaults_to_none():
    # called with the original 3 args (no dismissed) — still works
    posts = [{"title": "A", "url": "u1"}]
    out = fetch.dedup_candidates(posts, set(), set())
    assert [p["url"] for p in out] == ["u1"]


def test_filter_new_rejections_skips_queued():
    dropped = [
        {"post": {"url": "u1"}, "score": 2, "reason": "x"},
        {"post": {"url": "u2"}, "score": 3, "reason": "y"},
    ]
    queued = {"u1"}
    out = fetch.filter_new_rejections(dropped, queued)
    assert [d["post"]["url"] for d in out] == ["u2"]
    assert "u2" in queued  # mutated so later genres in the same run see it


def test_filter_new_rejections_dedups_within_batch():
    dropped = [
        {"post": {"url": "u1"}, "score": 2, "reason": "x"},
        {"post": {"url": "u1"}, "score": 1, "reason": "z"},
    ]
    out = fetch.filter_new_rejections(dropped, set())
    assert len(out) == 1


def test_filter_new_rejections_skips_missing_url():
    dropped = [{"post": {}, "score": 2, "reason": "x"}]
    out = fetch.filter_new_rejections(dropped, set())
    assert out == []
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd gideon && python -m pytest tests/test_fetch.py -v`
Expected: FAIL — `dedup_candidates` takes only 3 args (`TypeError`) and `fetch.filter_new_rejections` doesn't exist (`AttributeError`).

- [ ] **Step 3: Add the datetime import**

In `gideon/fetch.py`, change the import line `import json` block — add at the top (after `import json`):

```python
from datetime import datetime, timedelta, timezone
```

- [ ] **Step 4: Extend `dedup_candidates` to skip dismissed URLs**

Replace `dedup_candidates` (lines 78-94) with:

```python
def dedup_candidates(posts: list, existing_urls: set, existing_title_keys: set,
                     dismissed: set | None = None) -> list:
    """Filter candidates to those with a title+url that aren't URL dupes,
    same-title near-dupes, or tombstoned (dismissed) URLs. Mutates the two
    dedup sets so later candidates see earlier ones."""
    dismissed = dismissed or set()
    unique: list = []
    for post in posts:
        if not post.get("title") or not post.get("url"):
            continue
        if post["url"] in dismissed:
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
```

- [ ] **Step 5: Add the reject-queue helpers**

In `gideon/fetch.py`, add these functions (place them after `dedup_candidates`, before `insert_records`):

```python
def load_dismissed_urls(supabase: Client) -> set:
    """All tombstoned URLs — excluded from both the feed and the reject queue."""
    res = supabase.table("gideon_dismissed_urls").select("url").execute()
    return {row["url"] for row in res.data if row.get("url")}


def load_queued_reject_urls(supabase: Client) -> set:
    """URLs already sitting in the reject queue (from prior runs)."""
    res = supabase.table("gideon_rejections").select("url").execute()
    return {row["url"] for row in res.data if row.get("url")}


def load_live_gideon_urls(supabase: Client) -> set:
    """URLs already live as Gideon posts (any genre) — never re-queue these."""
    res = supabase.table("posts").select("url").eq("is_gideon", True).execute()
    return {row["url"] for row in res.data if row.get("url")}


def filter_new_rejections(dropped: list, skip_urls: set) -> list:
    """From judge drops, keep only entries whose URL isn't already in skip_urls
    (or missing), deduped within the batch. Mutates skip_urls so a URL dropped
    under one genre isn't re-queued under another in the same run. skip_urls is
    seeded with both queued-reject and live-post URLs by the caller; dismissed
    URLs are already excluded upstream by dedup_candidates."""
    out: list = []
    for d in dropped:
        url = d["post"].get("url")
        if not url or url in skip_urls:
            continue
        skip_urls.add(url)
        out.append(d)
    return out


def record_rejections(supabase: Client, dropped: list, genre: str, skip_urls: set) -> int:
    """Insert the judge's drops into gideon_rejections (skipping URLs already
    queued or live). Returns how many were recorded."""
    rows = filter_new_rejections(dropped, skip_urls)
    for d in rows:
        p = d["post"]
        supabase.table("gideon_rejections").insert({
            "title": p["title"],
            "url": p["url"],
            "content": p.get("content") or None,
            "image_url": p.get("image_url"),
            "genre": genre,
            "source": p["source"],
            "score": d["score"],
            "reason": d["reason"],
        }).execute()
    return len(rows)


def purge_expired_rejections(supabase: Client) -> None:
    """Delete un-actioned rejects older than 14 days (does NOT tombstone)."""
    cutoff = (datetime.now(timezone.utc) - timedelta(days=14)).isoformat()
    supabase.table("gideon_rejections").delete().lt("created_at", cutoff).execute()
```

- [ ] **Step 6: Wire it into `run()`**

In `gideon/fetch.py` `run()`, after the judge-config block (immediately before the `if os.environ.get("GIDEON_RESET", ...)` line), add:

```python
    # Reject-queue state: tombstoned URLs (excluded everywhere) + the set of
    # URLs a new reject must not duplicate (already queued OR already live).
    # Purge stale rejects once per run.
    dismissed_urls = load_dismissed_urls(supabase)
    reject_skip_urls = (
        load_queued_reject_urls(supabase) | load_live_gideon_urls(supabase)
        if judge_active else set()
    )
    purge_expired_rejections(supabase)
```

Then replace the per-genre select/insert block (lines 182-193, from `unique = dedup_candidates(...)` through `all_new_posts.extend(new_post_records)`) with:

```python
        unique = dedup_candidates(all_posts, existing_urls, existing_title_keys, dismissed_urls)
        if judge_active:
            selected, dropped = select_with_judge(
                unique, MAX_POSTS_PER_GENRE, lambda c: judge_post(c, judge_config)
            )
            recorded = record_rejections(supabase, dropped, genre_id, reject_skip_urls)
            if recorded:
                print(f"  Queued {recorded} rejected posts for {genre_id}")
        else:
            selected = unique[:MAX_POSTS_PER_GENRE]

        inserted, new_post_records = insert_records(supabase, selected, genre_id)
        print(f"  Inserted {inserted} posts for {genre_id}")
        total += inserted
        all_new_posts.extend(new_post_records)
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd gideon && python -m pytest tests/ -v`
Expected: PASS — `test_fetch.py` (existing 4 + new 5) and `test_judge.py` all green.

- [ ] **Step 8: Commit**

```bash
git add gideon/fetch.py gideon/tests/test_fetch.py
git commit -m "feat(gideon): record judge rejections, exclude tombstoned URLs, 14d purge"
```

---

### Task 4: Admin reject-action validator

**Files:**
- Create: `lib/admin/rejectionAction.ts`
- Create: `tests/lib/admin/rejectionAction.test.ts`

**Interfaces:**
- Produces: `parseRejectionAction(body: unknown): { ok: true; action: 'approve' | 'delete' } | { ok: false; error: string }`.

- [ ] **Step 1: Write the failing tests**

Create `tests/lib/admin/rejectionAction.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { parseRejectionAction } from '@/lib/admin/rejectionAction'

describe('parseRejectionAction', () => {
  it('accepts approve', () => {
    const r = parseRejectionAction({ action: 'approve' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.action).toBe('approve')
  })

  it('accepts delete', () => {
    const r = parseRejectionAction({ action: 'delete' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.action).toBe('delete')
  })

  it('rejects an unknown action', () => {
    const r = parseRejectionAction({ action: 'nuke' })
    expect(r.ok).toBe(false)
  })

  it('rejects a missing action', () => {
    const r = parseRejectionAction({})
    expect(r.ok).toBe(false)
  })

  it('rejects a non-object body', () => {
    const r = parseRejectionAction(null)
    expect(r.ok).toBe(false)
  })
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/lib/admin/rejectionAction.test.ts`
Expected: FAIL — cannot resolve `@/lib/admin/rejectionAction`.

- [ ] **Step 3: Implement the validator**

Create `lib/admin/rejectionAction.ts`:

```ts
// Validates the POST body for the reject-queue admin action. Pure (no Supabase)
// so it unit-tests without mocks.
export type RejectionAction = 'approve' | 'delete'

type Result =
  | { ok: true; action: RejectionAction }
  | { ok: false; error: string }

export function parseRejectionAction(body: unknown): Result {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be an object' }
  }
  const action = (body as Record<string, unknown>).action
  if (action === 'approve' || action === 'delete') {
    return { ok: true, action }
  }
  return { ok: false, error: "action must be 'approve' or 'delete'" }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/lib/admin/rejectionAction.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add lib/admin/rejectionAction.ts tests/lib/admin/rejectionAction.test.ts
git commit -m "feat(admin): reject-action validator + tests"
```

---

### Task 5: Reject-queue admin route, page, actions, and link

**Files:**
- Create: `app/api/admin/gideon/rejections/[id]/route.ts`
- Create: `app/(app)/admin/gideon/rejections/page.tsx`
- Create: `components/admin/RejectionActions.tsx`
- Modify: `app/(app)/admin/gideon/page.tsx` (add a "Rejected queue (N)" link)

**Interfaces:**
- Consumes: `parseRejectionAction` (Task 4); RPCs `gideon_approve_rejection(p_id)` / `gideon_dismiss_rejection(p_id)` (Task 1); `is_admin` RPC; `@/lib/supabase/server::createClient`.
- Produces: `POST /api/admin/gideon/rejections/[id]` → `{ ok: true }`; the `/admin/gideon/rejections` page; a count link on `/admin/gideon`.

- [ ] **Step 1: Implement the API route**

Create `app/api/admin/gideon/rejections/[id]/route.ts` (mirrors `app/api/admin/reports/[id]/route.ts`'s gate; Next 16 `await params`):

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseRejectionAction } from '@/lib/admin/rejectionAction'

// POST /api/admin/gideon/rejections/[id] — { action: 'approve' | 'delete' }.
// Admin-only; the RPCs re-check is_admin() and are the real guard.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: isAdmin } = await (supabase as any).rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseRejectionAction(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { id } = await params
  const fn = parsed.action === 'approve' ? 'gideon_approve_rejection' : 'gideon_dismiss_rejection'
  const { error } = await (supabase as any).rpc(fn, { p_id: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Implement the client actions component**

Create `components/admin/RejectionActions.tsx`:

```tsx
'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Approve (promote into the feed) / Delete (permanent tombstone) for one reject.
export function RejectionActions({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const act = async (action: 'approve' | 'delete') => {
    if (action === 'delete' && !confirm('Delete permanently? This URL will never be seeded again.')) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/gideon/rejections/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) { setErr((await res.json()).error || 'Failed'); return }
      router.refresh()
    } catch {
      setErr('Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {err && <span className="text-clay-deep text-xs">{err}</span>}
      <button onClick={() => act('approve')} disabled={busy}
        className="btn btn-primary text-sm px-3 py-1.5">Approve</button>
      <button onClick={() => act('delete')} disabled={busy}
        className="btn btn-ghost text-sm px-3 py-1.5">Delete</button>
    </div>
  )
}
```

- [ ] **Step 3: Implement the rejections page**

Create `app/(app)/admin/gideon/rejections/page.tsx`:

```tsx
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RejectionActions } from '@/components/admin/RejectionActions'

// Founder-only. The judge's rejected candidates (migration 032). Approve
// promotes into the feed; Delete tombstones the URL permanently.
export default async function AdminRejectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/feed')

  const { data: rejects } = await (supabase as any)
    .from('gideon_rejections')
    .select('id, title, url, genre, source, score, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="max-w-2xl mx-auto px-4 py-7">
      <h1 className="font-display text-3xl text-ink leading-none">Rejected by Gideon</h1>
      <p className="text-ink-faint text-sm mt-1.5 mb-5">
        Posts the judge dropped. Approve to publish, or delete permanently.
      </p>

      {(rejects ?? []).length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">Queue clear</p>
          <p className="text-ink-faint text-sm mt-1">Nothing rejected to review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(rejects ?? []).map((r: any) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="chip">{r.genre}</span>
                    <span className="chip">{r.source}</span>
                    <span className="text-clay-deep text-sm font-semibold">score {r.score}</span>
                  </div>
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="text-ink font-medium hover:underline block mt-1.5 break-words">{r.title}</a>
                  {r.reason && <p className="text-ink-soft text-sm mt-1 break-words">{r.reason}</p>}
                  <p className="text-ink-faint text-xs mt-1.5">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <RejectionActions id={r.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 4: Add the count link on `/admin/gideon`**

In `app/(app)/admin/gideon/page.tsx`, after the `gideon_judge_config_get` data is loaded (and before the `return`), add a count query:

```tsx
  const { count: rejectCount } = await (supabase as any)
    .from('gideon_rejections')
    .select('id', { count: 'exact', head: true })
```

Then, inside the returned JSX, immediately after the header `<div>` (the one containing the `<h1>Gideon judge</h1>`) and before `<JudgeConfigForm .../>`, add:

```tsx
      <a href="/admin/gideon/rejections"
        className="card p-4 flex items-center justify-between hover:border-clay transition-colors">
        <span className="text-ink font-medium flex items-center gap-2">🗂️ Rejected queue</span>
        <span className="text-ink-faint">{rejectCount ?? 0} ›</span>
      </a>
```

(If the page currently returns the "Judge config unavailable" early branch when `!config`, leave that branch as-is — the link only needs to appear in the normal render path.)

- [ ] **Step 5: Verify lint + full test suite**

Run: `npm run lint && npx vitest run`
Expected: no NEW lint errors in the added files (pre-existing repo-wide `no-explicit-any` from the mandated casts remain); all Vitest tests pass (including `tests/lib/admin/rejectionAction.test.ts`).

- [ ] **Step 6: Commit**

```bash
git add app/api/admin/gideon/rejections/[id]/route.ts "app/(app)/admin/gideon/rejections/page.tsx" components/admin/RejectionActions.tsx "app/(app)/admin/gideon/page.tsx"
git commit -m "feat(admin): reject-queue page, approve/delete actions, route + count link"
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

Add to the judge section: the judge's DROPs are recorded to `gideon_rejections` (migration 032) for admin review; `select_with_judge` returns `(kept, dropped)`; `record_rejections` queues drops (skipping live/queued URLs); `dedup_candidates` excludes tombstoned URLs (`gideon_dismissed_urls`); rejects auto-purge after 14 days. Restamp the timestamp.

- [ ] **Step 2: Update `arch-database.md`**

Bump migration range to `001–032`; add a `032_gideon_reject_queue` bullet (the two tables, admin-only RLS select, `gideon_approve_rejection`/`gideon_dismiss_rejection` RPCs, tombstone semantics). Restamp.

- [ ] **Step 3: Update `arch-moderation.md`**

Add `/admin/gideon/rejections` to the admin entry points (linked from `/admin/gideon` with a count) — the judge reject-review queue with Approve/Delete. Restamp.

- [ ] **Step 4: Update `index.md`**

Refresh the Gideon and Database lines to mention the reject queue / migration 032.

- [ ] **Step 5: Append a dated `log.md` entry**

Under today's `## 2026-06-30` heading (newest-first): "Gideon reject queue — `gideon_rejections` + `gideon_dismissed_urls` (migration 032), `select_with_judge` now returns drops, `/admin/gideon/rejections` Approve/Delete, 14d purge + permanent tombstone."

- [ ] **Step 6: Commit**

```bash
git add .knowledge/
git commit -m "docs(okf): record Gideon reject queue (migration 032, /admin/gideon/rejections)"
```

---

## Notes for the executor

- **Migration 032 is NOT auto-applied.** Apply it to prod via the aws-1 pooler with a throwaway `pg` script run by the user with the `!` prefix (the harness blocks autonomous prod-DB writes). The DB password lives only in that throwaway script, never committed; delete it after.
- **No APK rebuild** — web/server/DB/cron only.
- **Manual prod check after applying + deploying:** with the judge enabled, run the Gideon workflow; weak candidates should now log `Queued N rejected posts` and appear at `/admin/gideon/rejections`. Approve one → it shows in the feed and leaves the queue. Delete one → it's gone and won't return on the next run.
```
