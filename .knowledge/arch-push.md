---
type: architecture
title: Push Notifications (Android / FCM)
description: FCM HTTP v1 push via service-account JWT; device_tokens table; best-effort fan-out in sendPush
tags: [push, fcm, android, device-tokens, supabase, admin-client]
timestamp: 2026-06-23T00:00:00Z
---

# Push Notifications (Android / FCM)

Android push via **FCM HTTP v1**. No native SDKs added to Next.js; the Capacitor shell registers the FCM token and posts it to the API.

## New files (this session)
- `supabase/migrations/026_device_tokens.sql` — `device_tokens(id, user_id, token, platform, created_at)`, RLS (own rows only), index on `user_id`.
- `lib/supabase/admin.ts` — singleton service-role client (`createAdminClient()`) using `@supabase/supabase-js` directly; bypasses RLS; used by send path to read other users' tokens.
- `lib/push/fcm.ts` — `sendFcmMessage(token, {title, body, data?})`. Builds Google OAuth2 access token from service-account JWT (`FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `FCM_PROJECT_ID`); caches token until 60 s before expiry. Returns `{ok, invalidToken}` — never throws. `_setTokenFetcher(fn)` + `_resetTokenCache()` exported for tests.
- `lib/push/send.ts` — `sendPush(userId, {title, body, route?})`. Reads `device_tokens` via admin client, fans out `sendFcmMessage` in parallel, prunes tokens FCM marks as `UNREGISTERED`/`INVALID_ARGUMENT`. Entire body wrapped in try/catch — **never throws to caller**.

## Key invariants
- `sendPush` is **fire-and-forget safe**: callers (API routes) must not await-block on it.
- `sendFcmMessage` returns `{ok:false, invalidToken:false}` on any unexpected error — never throws.
- Token pruning on `invalidToken=true` keeps `device_tokens` clean automatically.
- Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) + FCM creds are server-only env vars.

## Hook points (pending wiring)
`app/api/swipes`, `app/api/requests`, `app/api/messages`, `app/api/internal/gideon-push` — none wired yet (next phase).
