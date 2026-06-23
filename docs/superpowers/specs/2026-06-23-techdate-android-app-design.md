# techDate Android App — Design Spec

**Date:** 2026-06-23
**Status:** Approved (brainstorming) — ready for implementation plan
**Author:** Anurag Upadhyay (with Claude)

## Goal

Run techDate as a real installable Android app with native push notifications,
at **zero cost**, reusing the existing Next.js 16 web app with no frontend rewrite.
iOS is explicitly **out of scope** for now (it cannot be done free: building/sideloading
needs a Mac, and iOS push needs a paid Apple Developer account at $99/yr).

## Constraints (driving decisions)

- **Free, no payments.** → Android-only. APK is free to build + sideload; the $25 Google
  fee is only for Play Store *publishing*, which we are not doing. FCM push is free.
- **Push is must-have.** Alerts for new Pings, new messages, and every new Gideon post
  (genre-matched) must reach the lock screen.
- **Reuse the existing app.** No rewrite of feed / discover / peers / chat / profile / admin.
- **Path to "later".** Approach must extend to iOS + store publishing if the user later
  chooses to pay, without throwing work away.

## Chosen approach: Capacitor wrapper + FCM push

A thin **Capacitor** Android shell loads the **already-deployed Next.js site** in a
WebView using `server.url` mode. All SSR, `middleware.ts` auth, API routes, and cookie
sessions keep working unchanged. The native shell adds: FCM push, splash screen, status
bar styling, app icon, and deep links.

### Rejected alternatives
- **Expo / React Native** — best native feel, but a full rewrite of every screen. Deferred;
  can be graduated to later if the wrapper's feel is insufficient.
- **PWA only** — push on iOS is weak/unreliable, and even on Android a wrapper gives a
  cleaner install + push story. Doesn't meet the must-have cleanly.

### Prerequisite (open item)
`server.url` requires the Next.js app to be reachable at a **public URL** (e.g. Vercel free
tier). Confirm the current deploy URL before wiring the Capacitor config. For local-only
testing, `server.url` can point at the dev machine LAN IP (`http://<lan-ip>:3000`) with
`cleartext: true`, but the production config should use the HTTPS deploy URL.

## Architecture

```
[Capacitor Android shell]  ──loads (server.url)──▶  [Live Next.js app @ deploy URL]
        │                                                    │
        ├─ @capacitor/push-notifications (FCM token)         ├─ existing UI + API routes
        ├─ splash / status bar / app icon / deep links       │
        └─ JS bridge ──posts FCM token──▶  POST /api/devices ─┴─▶ Supabase device_tokens
```

### Push registration flow
1. On launch (post-auth), the shell requests push permission and registers → receives an
   **FCM device token**.
2. The shell passes the token into the web context via the Capacitor JS bridge. The web app
   calls **`POST /api/devices`** with `{ token, platform: 'android' }`.
3. `/api/devices` upserts a row in **`device_tokens`** keyed by `(user_id, token)`.

### Push send flow
1. A push-worthy event fires in an existing API route (new Ping, Ping accepted, new message).
2. The route calls **`lib/push/send.ts::sendPush(recipientUserId, payload)`**.
3. `sendPush` looks up the recipient's `device_tokens`, sends via **FCM HTTP v1** (OAuth via
   the service-account key), and **deletes tokens** FCM reports as `UNREGISTERED` / invalid.
4. Payload carries a `route` field for deep-linking; tapping the notification opens that
   in-app route (e.g. `/messages/[matchId]`, `/discover` for pings).

## Push event hook points (verified against current code)

| Event | File | Where | Recipient | Notification |
|-------|------|-------|-----------|--------------|
| New Ping (someone right-swipes you) | `app/api/swipes/route.ts` | after a `right` swipe is recorded | the swiped user | "New Ping — someone wants to connect" → `/discover` (requests) |
| Ping accepted (match created) | `app/api/requests/route.ts` | after match insert (~line 64) | the original requester (`requester_id`) | "Your Ping was accepted — say hi" → `/messages/[matchId]` |
| New message | `app/api/messages/route.ts` | after message insert (~line 66) | the other match participant | "New message from {name}" → `/messages/[matchId]` |
| New Gideon post | `gideon/fetch.py` → `POST /api/internal/gideon-push` | after Gideon's run inserts posts | every user whose `interest_vector` contains the post's genre | "{genre}: {post title}" → the post in `/feed` |

Recipient for a message = whichever of `match.user1_id` / `match.user2_id` is **not** the
sender. Send is **best-effort and non-blocking**: a push failure must never fail or slow the
underlying API response (wrap in try/catch, do not await-block the response if avoidable).

### Gideon broadcast push (genre-matched, one per post)

Gideon is a **Python cron** (GitHub Actions, every 4h) with the Supabase service-role key —
not part of the Next.js runtime. To keep all FCM logic in one place (TypeScript), Gideon does
**not** send FCM directly. Instead:

1. `gideon/fetch.py::insert_posts` already inserts posts; change the insert to `.select()` the
   new row's `id` and collect `{ id, title, genre }` for each post actually inserted this run.
2. After `run()` finishes, Gideon POSTs the collected batch to
   **`POST /api/internal/gideon-push`** with a shared-secret header (`x-gideon-secret`).
3. The endpoint (server-only, **no cookie auth** — validates the secret) iterates the posts.
   For each post it finds users whose `interest_vector` contains the post's `genre` key, then
   calls `sendPush(userId, { title, body, route })` reusing the same FCM path as Pings/messages.
4. Granularity is **one push per post** (per the product decision); a user in N matching genres
   may receive up to `N × posts_per_genre` pushes per run. This is intentional; a future
   per-user mute/digest toggle is noted under Out of Scope.

"Matching genres" = the post's `genre` (a `genres.json` key, e.g. `ai`) appears as a key in the
user's `interest_vector` (which is seeded from the same genre keys at onboarding). Targeting and
fan-out reuse the **service-role client** (the endpoint reads many users' tokens).

**Efficiency note:** fan-out is per-user `sendPush`. At current scale this is fine; if Gideon
volume or user count grows, migrate genre broadcast to **FCM topics** (`genre_<key>`) so one FCM
message per post fans out server-side. Out of scope for the first cut.

## Data model

New migration **`026_device_tokens.sql`**:

```sql
create table device_tokens (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  token text not null,
  platform text not null default 'android',
  created_at timestamptz not null default now(),
  unique (user_id, token)
);
alter table device_tokens enable row level security;
-- A user may insert/select/delete only their own tokens.
create policy device_tokens_own on device_tokens
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
create index device_tokens_user_idx on device_tokens(user_id);
```

Server-side sends use the existing anon-key cookie client where the user owns the row
(registration). The **send path** reads *other users'* tokens, so `sendPush` must use a
**service-role client** (it bypasses RLS) — added as `lib/supabase/admin.ts` if not already
present. The FCM service-account key and Supabase service-role key live in server env only.

## New / changed files

- `supabase/migrations/026_device_tokens.sql` — table + RLS (new)
- `app/api/devices/route.ts` — `POST` (register token), `DELETE` (deregister on logout) (new)
- `lib/push/send.ts` — `sendPush(userId, { title, body, route })` via FCM HTTP v1 (new)
- `lib/push/fcm.ts` — FCM HTTP v1 client: OAuth token from service account, send call (new)
- `lib/supabase/admin.ts` — service-role client for the send path (new, if absent)
- `app/api/swipes/route.ts` — call `sendPush` on new right-swipe (edit)
- `app/api/requests/route.ts` — call `sendPush` on match creation (edit)
- `app/api/messages/route.ts` — call `sendPush` on new message (edit)
- `app/api/internal/gideon-push/route.ts` — secret-protected broadcast endpoint; resolves
  genre-matched users per post and fans out via `sendPush` (new)
- `gideon/fetch.py` — `.select()` inserted post ids; POST the batch to `/api/internal/gideon-push`
  after the run (edit)
- `.github/workflows/gideon.yml` — pass `APP_URL` + `GIDEON_PUSH_SECRET` to the cron (edit)
- `mobile/` — Capacitor project: `capacitor.config.ts` (`server.url`, appId, appName),
  Android platform, `google-services.json`, app icon + splash assets (new)
- Env: `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `GIDEON_PUSH_SECRET` (shared between the endpoint and the Gideon GitHub Action), `APP_URL`
  (Gideon's base URL for the endpoint call)

## Token / device bridge detail

Because the UI is the remote web app inside the WebView, the native FCM token must cross into
the web JS context. Implementation: a tiny init script in the Capacitor app registers the
push listener and, on token receipt, stores it and calls `fetch('/api/devices', …)` against
the loaded origin (same-origin, so the auth cookie is sent automatically). No separate auth
handshake needed — the WebView shares the logged-in session cookie.

## Testing

- Existing Vitest suite runs unchanged (web app untouched in behavior).
- New unit tests (FCM + Supabase mocked):
  - `app/api/devices` — token upsert, unauthorized rejection, duplicate `(user_id, token)`
    upsert is idempotent, `DELETE` removes only caller's token.
  - `lib/push/send.ts` — builds correct payload, fans out to multiple tokens, prunes tokens
    on `UNREGISTERED` response, no-op when recipient has zero tokens, never throws to caller.
  - Hook points — message/ping/accept routes still return success when `sendPush` throws
    (best-effort guarantee).
  - `app/api/internal/gideon-push` — rejects requests with a missing/wrong `x-gideon-secret`
    (401), sends one push per post only to users whose `interest_vector` contains the post's
    genre, skips users with no matching genre, and is resilient to individual `sendPush` failures.
- Manual: build signed APK in Android Studio, sideload, verify push arrives on lock screen
  for a real Ping and a real message, and that tapping deep-links correctly.

## Build & distribution (free)

1. `npm run build` deploy stays as-is (Vercel free tier or current host).
2. Create a free Firebase project → add Android app → download `google-services.json`,
   generate a service-account key for FCM HTTP v1.
3. `npx cap add android` → `npx cap sync`.
4. Build a **signed APK** in Android Studio (local keystore, free) → sideload to phone.
5. iOS: deferred. Revisit only if the user later opts to pay for an Apple Developer account
   and has Mac/cloud-build access.

## Out of scope (now)

- iOS app of any kind (cost + Mac requirement).
- Play Store / App Store publishing.
- React Native rewrite.
- Push for events other than new Ping, Ping accepted, new message, and new Gideon post (e.g.
  likes, comments, streak reminders) — can be added later by reusing `sendPush`.
- Per-user mute / digest / quiet-hours controls for Gideon push (one-per-post is intentional
  for now; revisit if it proves too noisy).
- Migrating Gideon genre broadcast from per-user fan-out to FCM topics.
```