---
type: architecture
title: Push Notifications (Android / FCM)
description: FCM HTTP v1 push via service-account JWT; device_tokens table; sendPush fan-out wired into Pings/messages/Gideon; Capacitor Android shell
tags: [push, fcm, android, device-tokens, supabase, admin-client, capacitor, gideon]
timestamp: 2026-06-24T00:00:00Z
---

# Push Notifications (Android / FCM)

Android push via **FCM HTTP v1**. No native SDKs added to Next.js; the Capacitor shell registers the FCM token and posts it to the API.

## New files (this session)
- `supabase/migrations/026_device_tokens.sql` — `device_tokens(id, user_id, token, platform, created_at)`, RLS (own rows only), index on `user_id`.
- `lib/supabase/admin.ts` — singleton service-role client (`createAdminClient()`) using `@supabase/supabase-js` directly; bypasses RLS; used by send path to read other users' tokens.
- `lib/push/fcm.ts` — `sendFcmMessage(token, {title, body, data?})`. Builds Google OAuth2 access token from service-account JWT (`FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `FCM_PROJECT_ID`); caches token until 60 s before expiry. Returns `{ok, invalidToken}` — never throws. `_setTokenFetcher(fn)` + `_resetTokenCache()` exported for tests.
- `lib/push/send.ts` — `sendPush(userId, {title, body, route?})`. Reads `device_tokens` via admin client, fans out `sendFcmMessage` in parallel, prunes tokens FCM marks as `UNREGISTERED`/`INVALID_ARGUMENT`. Entire body wrapped in try/catch — **never throws to caller**. `route` is passed through FCM `data.route` for deep-linking.

## Device registration
- `app/api/devices/route.ts` — `POST {token, platform}` upserts a row (onConflict `user_id,token`, idempotent) for the logged-in user via the normal cookie client (RLS allows own rows). `DELETE {token}` removes only the caller's row.
- `components/PushRegistrar.tsx` — `'use client'`, renders null, mounted in `app/(app)/layout.tsx`. Native-only (`Capacitor.isNativePlatform()` guard, dynamic `import('@capacitor/push-notifications')` so web/SSR bundles stay clean). On `registration` → `fetch('/api/devices', POST)` same-origin (cookie auth). On `pushNotificationActionPerformed` → `window.location.assign(data.route)`. All wrapped in try/catch.

## Capacitor shell
- `capacitor.config.ts` — `appId com.anurag.techdate`, `server.url` = `CAP_SERVER_URL` env or baked default `https://techdate-eta.vercel.app` (Vercel prod), `cleartext:false`. `android/` native project generated via `npx cap add android`; config synced in.
- Release signing wired in `android/app/build.gradle` to read `android/keystore.properties` (gitignored; `keystore.properties.example` template) → `./gradlew assembleRelease` yields a signed APK once the keystore exists. Google-Services classpath already present.
- Thin shell: loads the deployed Next.js site in a WebView; only adds push + splash + icon. No frontend rewrite. iOS deliberately out of scope (cost + Mac).
- Manual setup checklist (Firebase, google-services.json, keystore, APK build, sideload, apply migration 026): `mobile/MOBILE.md`.

## Key invariants
- `sendPush` is **fire-and-forget safe**: callers (API routes) must not await-block on it.
- `sendFcmMessage` returns `{ok:false, invalidToken:false}` on any unexpected error — never throws.
- Token pruning on `invalidToken=true` keeps `device_tokens` clean automatically.
- Service-role key (`SUPABASE_SERVICE_ROLE_KEY`) + FCM creds are server-only env vars.

## Hook points (wired)
All fire-and-forget via `void Promise.resolve().then(() => sendPush(...)).catch(()=>{})` (microtask defer so even a sync throw can't touch the response):
- `app/api/swipes/route.ts` — right-swipe → push to `swiped_id` ("New Ping", route `/discover`). Left-swipe does not push.
- `app/api/requests/route.ts` — accept that creates a match → push to `requester_id` ("Ping accepted", route `/messages/{matchId}`).
- `app/api/messages/route.ts` — new message → push to the other participant ("New message", body = content snippet ≤80 chars, route `/messages/{matchId}`).
- `app/api/internal/gideon-push/route.ts` — **broadcast endpoint**, secret-gated by header `x-gideon-secret` === `GIDEON_PUSH_SECRET` (fails closed if unset). Body `{posts:[{id,title,genre}]}`. Loads all users once via admin client, pushes one notification per post **only to users whose `interest_vector` contains the post's genre key** (route `/feed`). Resilient per-user; returns `{sent}`.

## Gideon integration
`gideon/fetch.py` now captures inserted post records `{id,title,genre}` and, after the run, POSTs them to `${APP_URL}/api/internal/gideon-push` with the secret header (best-effort try/except — never crashes the cron). `.github/workflows/gideon.yml` passes `APP_URL` + `GIDEON_PUSH_SECRET` from repo secrets. Granularity is one push per post (intentional); per-user mute/digest + FCM-topics migration are noted future work.

## Server env required
`SUPABASE_SERVICE_ROLE_KEY`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `GIDEON_PUSH_SECRET`, `APP_URL` (Gideon), `CAP_SERVER_URL` (build).

## Tests
`tests/lib/push/{fcm,send}.test.ts`, `tests/lib/api/{devices,push-hooks,gideon-push}.test.ts` — full suite 69/69 green, tsc clean.
