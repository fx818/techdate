---
type: architecture
title: Push Notifications (Android / FCM)
description: FCM HTTP v1 push via service-account JWT; device_tokens table; sendPush fan-out wired into Pings/messages/Gideon; Capacitor Android shell + PWA caching + branded notification icon
tags: [push, fcm, android, device-tokens, supabase, admin-client, capacitor, gideon, pwa, serwist]
timestamp: 2026-06-26T00:00:00Z
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
- `capacitor.config.ts` — `appId com.await.com`, `appName Await`, `server.url` = `CAP_SERVER_URL` env or baked default `https://techdate-eta.vercel.app` (Vercel prod), `cleartext:false`. `android/` native project: `namespace`+`applicationId` = `com.await.com`, MainActivity at `com/await/com/`, strings (app_name/title/package/url_scheme) = Await/com.await.com. **applicationId MUST equal `google-services.json` `package_name` (`com.await.com`, Firebase project `await-18651`)** or the build fails. Push copy reads "Await". `android/app/google-services.json` committed.
- Release signing wired in `android/app/build.gradle` to read `android/keystore.properties` (gitignored; `keystore.properties.example` template) → `./gradlew assembleRelease` yields a signed APK once the keystore exists. Google-Services classpath already present.

## PWA caching (startup performance — added 2026-06-26)
The shell loads the remote site, so repeat launches were network-gated. Added **Serwist** (`@serwist/next`) so the WebView (Chromium) caches the app shell:
- `app/sw.ts` — `Serwist({ precacheEntries: self.__SW_MANIFEST, skipWaiting, clientsClaim, navigationPreload, runtimeCaching: defaultCache })`. `defaultCache` = NetworkFirst for navigations (safe for cookie auth — always revalidates) + StaleWhileRevalidate for `/_next/static`, images, fonts.
- `next.config.ts` wraps config with `withSerwistInit({ swSrc:'app/sw.ts', swDest:'public/sw.js', disable: NODE_ENV==='development' })`. **`public/sw.js` is gitignored** (build artifact).
- **CRITICAL build coupling:** Serwist 9.x is webpack-only; Next 16 defaults to Turbopack. The `build` script MUST stay `next build --webpack` or the SW silently does NOT emit (no error, `/sw.js` 404s, caching gone). Keep Vercel Build Command = `npm run build`. Remove `--webpack` only when serwist supports Turbopack (serwist/serwist#54).
- `app/manifest.ts` (Next metadata route) — Await name/colors, icons `public/icon-{192,512}.png`. Supabase preconnect hints in `app/layout.tsx` (`https://ynfkwndtmoajcmjppftp.supabase.co`). First-ever launch still network-bound; every launch after is near-instant. SW scope is tied to the deploy origin — if `CAP_SERVER_URL` moves, update the preconnect URL too.

## Startup splash + app icon
- **No black launch:** `capacitor.config.ts` `backgroundColor: '#f4f2eaff'` (cream WebView bg) + `@capacitor/splash-screen` held (`launchAutoHide: false`) until the web app calls `SplashScreen.hide()`. Android-12 system splash bg also cream (`styles.xml` `windowSplashScreenBackground=@color/await_paper`).
- **Black-flash fix (2026-06-26):** the post-splash theme `AppTheme.NoActionBar` had `android:background=@null` → black OS window showed through during the WebView's first-paint gap. Fixed by adding `android:windowBackground=@color/await_paper` (cream) to that theme + `MainActivity.onCreate` sets `bridge.getWebView().setBackgroundColor(#f4f2ea)`. Cream now goes system-splash → window → WebView → AwaitSplash overlay with no seam.
- **Notification small icon (2026-06-26):** `AndroidManifest.xml` now has `com.google.firebase.messaging.default_notification_icon=@drawable/ic_stat_await` + `default_notification_color=@color/await_clay` (`#cc7a57`). `ic_stat_await` is a WHITE "A" silhouette on transparent at 5 densities (24/36/48/72/96 px) — Android tints by alpha only, so it MUST be monochrome (a colored logo renders as a white blob). Generated by `scripts/gen-art.mjs` (white glyph, `withDot:false`) straight into `res/drawable-*dpi/`. Without this, background FCM notifications showed a generic grey square.
- **Bigger "A." glyph (2026-06-26):** `gen-art.mjs` foreground fontSize 430→480, full-bleed icon-only 560→620 (splash wordmark unchanged); regenerated via `npx capacitor-assets generate --android`.
- **Web overlay** `components/AwaitSplash.tsx` (mounted in root `app/layout.tsx`): server-rendered cream overlay, "Await." (Fraunces) fade-in+rise (CSS `await-rise` in globals.css), then fades out. On native it calls `SplashScreen.hide()` (cream→cream handoff) then fades after ~1.1s; on web ~0.35s. **Because `launchAutoHide:false`, the deployed site MUST contain AwaitSplash or the native splash never dismisses** — deploy web before shipping the APK.
- **App icon:** clay "A." on cream (Claude-style). Source art in `resources/` generated by `scripts/gen-art.mjs` (sharp+SVG, serif), fanned out to all densities + adaptive icon (fg=clay "A.", bg=cream) + splash via `npx capacitor-assets generate --android`. Regenerate: edit gen-art.mjs → run it → run capacitor-assets.
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
- `app/api/internal/gideon-push/route.ts` — **broadcast endpoint**, secret-gated by header `x-gideon-secret` === `GIDEON_PUSH_SECRET` (fails closed if unset). Body `{posts:[{id,title,genre}]}`. Loads all users once via admin client, pushes one notification per post **only to users whose `interest_vector` contains the post's genre key** (route `/posts/${post.id}` — deep-links to the post detail, which resolves a UUID to the canonical slug). Resilient per-user; returns `{sent}` (note: `sent` counts post×matching-user across ALL users incl. tokenless ones, so it over-counts actual deliveries).

## Gideon integration
`gideon/fetch.py` now captures inserted post records `{id,title,genre}` and, after the run, POSTs them to `${APP_URL}/api/internal/gideon-push` with the secret header (best-effort try/except — never crashes the cron). `.github/workflows/gideon.yml` passes `APP_URL` + `GIDEON_PUSH_SECRET` from repo secrets. Granularity is one push per post (intentional); per-user mute/digest + FCM-topics migration are noted future work.

## Server env required
`SUPABASE_SERVICE_ROLE_KEY`, `FCM_PROJECT_ID`, `FCM_CLIENT_EMAIL`, `FCM_PRIVATE_KEY`, `GIDEON_PUSH_SECRET`, `APP_URL` (Gideon), `CAP_SERVER_URL` (build).

## Tests
`tests/lib/push/{fcm,send}.test.ts`, `tests/lib/api/{devices,push-hooks,gideon-push}.test.ts` — full suite 69/69 green, tsc clean.
