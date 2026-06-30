# Gideon LLM-Judge Layer — Design

**Date:** 2026-06-30
**Status:** Approved (design), pending spec review
**Area:** Gideon cron (`gideon/`), admin UI (`app/(app)/admin/`), DB (`supabase/migrations/`)

## Goal

Add an LLM-as-judge quality gate to the Gideon content-seeding cron. After candidates are ranked and deduplicated, an LLM scores each one 0–10; only those scoring at or above a threshold are inserted. All judge configuration (API key, base URL, model, enabled flag, criteria prompt, pass threshold) lives in the database and is editable by an admin from the app — never in env.

## Decisions (locked during brainstorming)

- **Judge role:** Filter the top-N. Judge runs *after* ranking + dedup, on the candidates about to be inserted. Verdict gates insertion.
- **Backfill:** When judged candidates are dropped, keep pulling the next-best ranked candidates and judging them until **N** pass or the candidate pool is exhausted. The pool is naturally bounded per genre, so the loop self-caps.
- **Failure mode:** Fail open. If the judge cannot run (no key, disabled, API error, malformed response), fall back to today's behavior (insert ranked top-N) and log a warning. Quality gate is best-effort; the cron never breaks and the feed never goes empty.
- **Admin-editable config fields:** API key, base URL, model, enabled toggle, criteria prompt, pass threshold (0–10).
- **API key handling:** Write-only / masked. The admin page shows only `key_set` + last-4; the full key is never returned to the browser. A blank key field on save keeps the existing key.
- **Provider:** Gemini via its OpenAI-compatible chat-completions endpoint (default). The key/base-url/model fields make the provider swappable without a code change.
- **Lives inside the Gideon cron only.** No app-server runtime path calls the judge.

## Provider integration

Call the model through an **OpenAI-compatible** `/chat/completions` request (not Google's native SDK), so the three config fields are all that's needed to target a provider.

Defaults:
- `base_url = https://generativelanguage.googleapis.com/v1beta/openai/`
- `model = gemini-2.5-flash`

The judge prompt instructs the model to return strict JSON: `{"score": <0-10 integer>, "reason": "<short string>"}`. The response is parsed defensively (tolerate code fences / surrounding text by extracting the first JSON object). A parse failure is treated as a single-candidate error → fail open (that candidate passes).

## Component 1 — DB: `gideon_judge_config` (migration 031)

Single-row (singleton) table:

| column | type | notes |
|---|---|---|
| `id` | int PK | CHECK (`id = 1`) — enforces exactly one row |
| `enabled` | bool | default `false` |
| `api_key` | text | nullable, plaintext |
| `base_url` | text | default `'https://generativelanguage.googleapis.com/v1beta/openai/'` |
| `model` | text | default `'gemini-2.5-flash'` |
| `criteria` | text | the judge prompt / quality bar; seeded with a sensible default |
| `pass_threshold` | int | default `6`, CHECK (`0 <= pass_threshold <= 10`) |
| `updated_at` | timestamptz | default `now()` |
| `updated_by` | uuid | nullable, → `users.id` |

- RLS enabled. SELECT and UPDATE policies allow only `is_admin()`. No INSERT policy needed (the row is seeded by the migration). Gideon uses the service-role client, which bypasses RLS and reads the raw `api_key`.
- The migration seeds the single row with `enabled = false`, defaults above, and a default `criteria` prompt.

Two SECURITY DEFINER, `is_admin()`-gated RPCs (same pattern as `admin_metrics()`):

- `gideon_judge_config_get()` → returns JSON with every field **except** the raw `api_key`, plus `key_set boolean` and `key_last4 text`. Returns `null` to non-admins.
- `gideon_judge_config_save(p_enabled bool, p_base_url text, p_model text, p_criteria text, p_threshold int, p_api_key text)` → updates the row; if `p_api_key` is `null` or empty, the existing `api_key` is left unchanged. Sets `updated_at = now()`, `updated_by = auth.uid()`. Returns the masked config (same shape as `_get`). No-op / null for non-admins.

## Component 2 — Admin UI: `/admin/gideon`

- New page `app/(app)/admin/gideon/page.tsx` — server component, gated exactly like `/admin/metrics` (`getUser()` → `users.is_admin` → redirect `/feed` if not admin). Loads config via `gideon_judge_config_get()` RPC.
- Client form component `components/admin/JudgeConfigForm.tsx` — fields for enabled toggle, base URL, model, criteria (textarea), pass threshold, and API key (`password`-type input, placeholder shows `••••{last4}` + "key set" when one exists; blank means keep current). POSTs to the API route.
- API route `app/api/admin/judge/route.ts` (`POST`) — does its own `getUser()` + `is_admin` check, then calls `gideon_judge_config_save(...)`. Returns the masked config.
- Profile entry point: add a "🤖 Gideon judge" link to the Admin section in `app/(app)/profile/page.tsx`, alongside Reports and Metrics.

## Component 3 — Gideon pipeline: `gideon/judge.py`

- `load_config(supabase)` → reads the `gideon_judge_config` singleton via the service-role client. Returns a config dict, or `None` if the row is missing / unreadable.
- `judge_post(post, config)` → issues one OpenAI-compatible chat-completion call using `config` (key/base_url/model/criteria). Returns `(keep: bool, score: int, reason: str)`. On any request or parse error, returns `keep = True` (fail open) with a sentinel reason.
- `fetch.py` integration: per genre, after `merge_normalized` + dedup produce the ranked candidate list, walk it in ranked order:
  - If config is missing or `enabled = false` → skip judging entirely, insert the ranked top-N (today's behavior). Log a warning if a key was expected but absent.
  - Otherwise judge each candidate; collect those with `score >= pass_threshold` until N are kept or the list is exhausted (the **backfill** loop).
  - A single-candidate judge error counts as a pass (fail open).
- Logging: keeps/drops with scores and reasons are printed to the Actions console (no per-post DB audit — out of scope).

## Component 4 — Testing

- **Python unit tests for `judge.py`** (LLM call mocked, no network):
  - parses well-formed JSON; extracts JSON from a fenced/decorated response.
  - malformed / non-JSON response → fail open (`keep = True`).
  - threshold boundary: `score == threshold` passes, `score == threshold - 1` fails.
  - request exception → fail open.
  - backfill loop: stops once N pass; exhausts the pool when fewer than N pass.
- **Admin route check:** non-admin POST is rejected; a save with a blank `api_key` preserves the existing key.

## Out of scope (YAGNI)

- Per-post verdict history persisted in the DB.
- Encrypted-at-rest API key (plaintext, RLS-protected, service-role-read is sufficient for this stage).
- Multiple provider config rows / per-genre judge config.
- Re-ranking candidates by judge score (the judge only gates; ranking stays `merge_normalized`).

## DB constraint note

This change adds no new `posts.source` values, so the `posts_source_check` trap that bit migrations 027/029 does not apply here.
