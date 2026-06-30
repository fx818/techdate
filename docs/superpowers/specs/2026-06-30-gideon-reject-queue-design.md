# Gideon Reject Queue with Admin Override — Design

**Date:** 2026-06-30
**Status:** Approved (design), pending spec review
**Area:** Gideon cron (`gideon/`), admin UI (`app/(app)/admin/gideon/`), DB (`supabase/migrations/`)
**Builds on:** the LLM-judge gate (`docs/superpowers/specs/2026-06-30-gideon-llm-judge-design.md`, migration 031)

## Goal

Make the Gideon judge's rejections visible and actionable. Every post the judge DROPs is recorded with its score + reason in an admin-only queue, where the founder can **Approve** it (promote into the feed) or **Delete** it permanently (tombstone — never re-surfaces).

## Decisions (locked during brainstorming)

- **Review model:** post-hoc, rejects-only. Judge KEEPs auto-publish to the feed exactly as today. Judge DROPs go into a review queue. The override is one-directional — promote a reject into the feed, or delete it. Live (kept) posts are never touched by this feature.
- **Per-reject actions:** **Approve** → insert into `posts` as a Gideon post, remove from queue. **Delete** → permanent: tombstone the URL and remove from queue.
- **Re-surfacing:** a deleted URL is tombstoned so Gideon never re-queues it as a reject **and** never re-posts it to the feed. "Delete" means gone for good.
- **Retention:** un-actioned rejects auto-expire after **14 days**. Expiry only clears the queue — it does **not** tombstone (only an explicit Delete does).
- **Rejects captured only when the judge is enabled.** With the judge off, top-N posts publish as before and nothing is queued.

## Component 1 — DB: migration 032

### Table `gideon_rejections`
| column | type | notes |
|---|---|---|
| `id` | uuid PK | `default gen_random_uuid()` |
| `title` | text | |
| `url` | text | **unique** — one queue entry per link |
| `content` | text | nullable (source excerpt, if any) |
| `image_url` | text | nullable (source-provided only; no og-scrape) |
| `genre` | text | |
| `source` | text | one of the existing `posts.source` values |
| `score` | int | judge score 0–10 |
| `reason` | text | judge's reason string |
| `created_at` | timestamptz | `default now()` |

- RLS enabled. SELECT + DELETE policies allow only `is_admin()`. Gideon writes via the service-role client (bypasses RLS). No INSERT policy needed for the app (inserts happen only from Gideon and from the SECURITY DEFINER RPCs).
- Index on `created_at desc` for the newest-first admin list and the 14-day purge.

### Table `gideon_dismissed_urls`
| column | type | notes |
|---|---|---|
| `url` | text PK | the tombstone |
| `created_at` | timestamptz | `default now()` |

- RLS enabled, admin-only SELECT. Written by the dismiss RPC (and read by Gideon via service role).

### RPCs (all SECURITY DEFINER, `set search_path = public`, `is_admin()`-gated, granted to `authenticated`)
- `gideon_approve_rejection(p_id uuid) returns uuid` — if not admin, return null. Read the reject row by id; insert into `posts` with `is_gideon=true`, `author_id=null`, `title/url/content/image_url/genre/source` from the row, and a generated unique `slug` (slugify in SQL: lowercase, non-alphanumerics→`-`, trim, cap 60; append a short random suffix if the slug already exists). Delete the reject row. Return the new post id.
- `gideon_dismiss_rejection(p_id uuid) returns boolean` — if not admin, return null. Insert the row's `url` into `gideon_dismissed_urls` (`on conflict do nothing`), delete the reject row, return true.

The reject **list** is read directly by the admin page via `(supabase as any).from('gideon_rejections').select(...)` under the admin SELECT policy — a reject row holds no secrets, so no RPC is needed for reads.

## Component 2 — Gideon (Python)

- **`select_with_judge` returns both kept and dropped.** New return shape `(kept: list, dropped: list)` where `dropped` is a list of `{post, score, reason}` for candidates the judge scored below threshold *during the backfill walk*. Candidates the walk never reached (because the quota filled) are not rejections and are not captured.
- **`dedup_candidates` also excludes dismissed URLs.** It takes an additional `dismissed: set[str]` and skips any candidate whose URL is tombstoned — so a dismissed link is never judged, never posted, and never re-queued (the "never again" guarantee on both the feed and reject paths).
- **`record_rejections(supabase, dropped, genre)`** — inserts the dropped candidates into `gideon_rejections` (`on conflict (url) do nothing`). Before insert it skips URLs that are already live in `posts`, already tombstoned, or already queued. Stores the source-provided `image_url` (or null) — no og-scrape for rejects.
- **`purge_expired_rejections(supabase)`** — `delete from gideon_rejections where created_at < now() - interval '14 days'`, called once at the start of `run()`.
- **Loads needed once per run:** the dismissed-URL set (and, for `record_rejections`, the existing reject URLs) via the service-role client.

`run()` flow per genre becomes: `merge_normalized` → `dedup_candidates(…, dismissed)` → if judge active: `kept, dropped = select_with_judge(…)`, then `record_rejections(dropped, genre)`; else `kept = unique[:MAX]`, `dropped = []` → `insert_records(kept)`.

## Component 3 — App (admin UI)

- **`app/(app)/admin/gideon/rejections/page.tsx`** — server component, admin-gated (`getUser()` → `users.is_admin` → redirect `/feed`), mirrors the other admin pages. Lists rejects newest-first: title (links to the URL), source chip, genre, a **score badge**, the judge **reason**, and Approve / Delete buttons. Empty-state when the queue is clear.
- **`components/admin/RejectionActions.tsx`** — client component with Approve + Delete buttons; `POST`s to the route, removes the row from the view on success (or refreshes).
- **`app/api/admin/gideon/rejections/[id]/route.ts`** — `POST` (Next 16: `await params`). Own `getUser()` + `is_admin` RPC check (401/403). Body `{ action: 'approve' | 'delete' }` validated; calls `gideon_approve_rejection` or `gideon_dismiss_rejection`; 400 on bad action, 500 on RPC error.
- **`/admin/gideon` page** gains a **"Rejected queue (N)"** link to the new page, with the current count.

## Component 4 — Testing

- **Python** (mock-free where possible): `select_with_judge` returns the dropped list with score/reason; `dedup_candidates` excludes dismissed URLs; `record_rejections` skips live/queued/tombstoned URLs (driven via a fake supabase stub or by factoring the skip predicate into a pure helper).
- **App:** a pure validator for the route body (`action` ∈ {approve, delete}) unit-tested in Vitest; the admin-gate mirrors the existing tested pattern.

## Out of scope (YAGNI)

- Storing score/reason on *kept* posts.
- Editing a reject's fields before approving.
- Bulk approve/delete.
- Manual "re-judge this URL" action.

## Notes / tradeoffs

- **Approved posts use the source-provided image only** (no og-scrape at approve time — that path is Python-only). HN-style links may publish without a thumbnail. Acceptable for this stage.
- **No new `posts.source` value** is introduced (approve reuses the candidate's original source), so the `posts_source_check` CHECK is untouched.
- Migration 032 is applied to prod manually via the aws-1 pooler, like 031.
