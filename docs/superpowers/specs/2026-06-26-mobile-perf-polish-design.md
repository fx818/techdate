# Mobile Performance + Polish Pass — Design

**Date:** 2026-06-26
**Status:** Approved (design)
**Area:** Android Capacitor shell (`android/`), Next.js web app, icon/splash art

## Problem

The Android app (a thin Capacitor WebView shell that loads the live Vercel site
over the network — `capacitor.config.ts` → `server.url`) feels slow and not
smooth. Four concrete complaints:

1. **Slow startup / not smooth** — every cold launch is a full network fetch of
   the Next.js site in the WebView. No bundled assets, no offline/cache layer.
2. **Black flash** before the "Await." splash animation on cold start.
3. **Push notifications show no app logo** — generic grey square instead of brand.
4. **The "A." glyph is too small** to read clearly in the icon/splash.

Root cause of #1 is architectural: "a website in a box." Chosen direction
(confirmed with user): **PWA caching + native tuning** — keep the remote-URL
shell, but cache the app shell so repeat launches feel native, and tune the
native layer. (Full local-bundle re-architecture was explicitly out of scope.)

## Scope (4 workstreams + build/verify)

### A. Startup speed — PWA service-worker caching (web; deploys to Vercel)

The WebView is Chromium-based, so it honors a service worker served from Vercel.

- Add **Serwist** (`@serwist/next`) — the maintained PWA library for Next.js 16
  App Router (`next-pwa` is stale on 16). Wire via `next.config.ts`.
- Service worker caching strategy:
  - `/_next/static/*` (immutable hashed JS/CSS) → **stale-while-revalidate /
    cache-first** → 2nd-launch-onward assets load from disk, no network.
  - Page navigations (HTML) → **network-first** with cache fallback. Safe for
    cookie auth (always tries network first); offline shows last cached shell.
  - Images/fonts → stale-while-revalidate.
- Add `public/manifest.json` (or `app/manifest.ts`) + manifest link in the root
  layout `<head>`.
- Add `<link rel="preconnect">` hints to the Supabase origin + Vercel so first
  contentful paint is faster even on the network-bound first launch.

**Constraint:** the first-ever launch is still network-bound (unavoidable with a
remote-URL shell). The win is every launch after the first.

### B. Kill the black flash (native)

Hypothesis (from static reading): the post-splash theme `AppTheme.NoActionBar`
in `android/app/src/main/res/values/styles.xml` sets
`<item name="android:background">@null</item>` → transparent window → the black
OS window shows through during the WebView's first-paint gap.

- Set `android:windowBackground` = `@color/await_paper` (cream) on the
  post-splash theme so any first-paint gap renders cream, not black.
- Set the WebView's own background to cream natively in `MainActivity`.
- Verify the `SplashScreen.hide({ fadeOutDuration: 200 })` handoff timing in
  `components/AwaitSplash.tsx` so the cream→cream handoff has no visible seam.

**Risk:** root cause is a strong hypothesis, not on-device-confirmed. If the
windowBackground fix doesn't fully eliminate the flash, profile a cold launch
on-device (logcat / Android Studio profiler) before further changes.

### C. Push notification logo (native)

`AndroidManifest.xml` currently has **no** FCM notification-icon meta-data, so
background notifications fall back to a generic grey square.

- Generate a **white-silhouette "A." small icon** (`ic_stat_await`) at all
  densities (mdpi 24px → xxxhdpi 96px). Android tints the small icon, so it
  MUST be monochrome white on transparent — a colored logo renders as a white
  blob. Generate via `scripts/gen-art.mjs` (new variant) → place in
  `android/app/src/main/res/drawable-*dpi/`.
- Add two `<meta-data>` lines under `<application>` in `AndroidManifest.xml`:
  - `com.google.firebase.messaging.default_notification_icon` → `@drawable/ic_stat_await`
  - `com.google.firebase.messaging.default_notification_color` → `@color/await_clay`
    (add the clay color to `colors.xml` if not present).

### D. Bigger "A." glyph (art)

In `scripts/gen-art.mjs`, increase the glyph `fontSize`:
- Adaptive-icon foreground: 430 → ~480.
- Full-bleed icon: 560 → ~620.
("+1px" on a 1024 canvas is invisible; make a visible bump and tune from the
rendered output.) Regenerate launcher/adaptive/splash assets via
`npx capacitor-assets generate --android`.

### Build & verify

1. `npx cap sync android`
2. `./gradlew assembleRelease` (signed — keystore already wired in
   `android/app/build.gradle` reading `keystore.properties`) **in this env** →
   produce the APK for sideload.
3. On-device confirmation by user:
   - No black flash on cold start.
   - Noticeably faster repeat launch (2nd+ launch).
   - Push notification shows the "A." brand icon + clay tint.
   - "A." glyph visibly larger.

**Risk:** the gradle toolchain (JDK / Android SDK) working headless in this env
is unverified. If `./gradlew` fails, fall back to giving exact Android Studio
build steps (the path used to ship the last APK).

## Files touched (anticipated)

- `next.config.ts` — Serwist wiring
- `package.json` — add `@serwist/next`, `serwist`
- `app/sw.ts` (or equivalent) — service worker source
- `public/manifest.json` or `app/manifest.ts` — web manifest
- `app/layout.tsx` — manifest link + preconnect hints
- `android/app/src/main/res/values/styles.xml` — windowBackground cream
- `android/app/src/main/java/.../MainActivity.java` — WebView background
- `android/app/src/main/AndroidManifest.xml` — FCM notification meta-data
- `android/app/src/main/res/values/colors.xml` — clay color (if missing)
- `android/app/src/main/res/drawable-*dpi/ic_stat_await.png` — small icons (new)
- `scripts/gen-art.mjs` — bigger glyph + new `ic_stat` variant
- regenerated icon/splash assets

## Non-goals

- Local-bundle re-architecture (static export / offline-first data). Explicitly
  out of scope.
- iOS (no Mac; out of scope per existing project decisions).
- Any web feature/UX change beyond caching + preconnect.

## Success criteria

Repeat launches feel near-instant; no black flash; push notifications branded;
"A." readable. Full test suite still green; `tsc` clean; signed APK builds.
