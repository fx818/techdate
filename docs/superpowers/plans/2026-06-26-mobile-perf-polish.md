# Mobile Performance + Polish Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Await Android app feel fast and polished — near-instant repeat launches, no black flash on startup, branded push-notification icon, and a more legible "A." glyph.

**Architecture:** Keep the thin Capacitor WebView shell that loads the remote Vercel site (`server.url`). Add a Serwist service worker on the web side so the WebView caches the app shell (repeat launches load assets from disk). Fix the native black-flash via window/WebView background color. Add FCM notification-icon meta-data + a white-silhouette small icon. Enlarge the generated glyph.

**Tech Stack:** Next.js 16 (App Router), React 19, Serwist (`@serwist/next`), Capacitor 8 (Android), `@capacitor/assets`, `sharp` (asset generation), Gradle.

## Global Constraints

- Brand name is **Await**; appId **`com.await.com`**; Firebase project `await-18651`. Copy verbatim — never "techdate" in user-facing strings.
- Palette: cream/paper `#f4f2ea`, clay `#cc7a57`, ink `#2a2722`.
- Every server-side Supabase query uses `(supabase as any).from(...)` — do not touch existing casts.
- Full Vitest suite must stay green (`npm test`) and `tsc` clean after web changes.
- Native changes only take effect in a rebuilt APK; PWA changes only take effect after the web app is deployed to Vercel (the WebView loads the remote site).
- The signed release build requires `android/keystore.properties` (gitignored) to exist locally; it already does.
- Do NOT change `capacitor.config.ts` `server.url` or the local-bundle architecture — out of scope.

---

### Task 1: PWA service-worker caching (web)

Adds Serwist so the WebView caches `/_next/static/*` and navigations. Deployable to Vercel independently of the APK. First launch stays network-bound; every launch after is near-instant.

**Files:**
- Modify: `package.json` (add deps)
- Create: `app/sw.ts`
- Modify: `next.config.ts`
- Create: `app/manifest.ts`
- Modify: `app/layout.tsx` (preconnect hints)
- Modify: `.gitignore` (ignore generated `public/sw.js`)

**Interfaces:**
- Produces: a service worker served at `https://<vercel-domain>/sw.js`, scope `/`, auto-registered by `@serwist/next`. No code consumes this from other tasks.

- [ ] **Step 1: Install Serwist**

Run (install the current release — do NOT hard-pin a major that may predate Next 16 support):
```bash
npm install @serwist/next && npm install -D serwist
```
Expected: `@serwist/next` in `dependencies`, `serwist` in `devDependencies`, no peer-dep errors. If npm reports a peer-dep conflict against `next@16`, note the installed Serwist version and confirm at the Step 8 build whether the SW emits cleanly; if Serwist's published range excludes Next 16, fall back to `--legacy-peer-deps` and rely on Step 8 to validate.

- [ ] **Step 2: Create the service worker source**

Create `app/sw.ts`:
```ts
import { defaultCache } from "@serwist/next/worker";
import type { PrecacheEntry, SerwistGlobalConfig } from "serwist";
import { Serwist } from "serwist";

declare global {
  interface WorkerGlobalScope extends SerwistGlobalConfig {
    // Injected by @serwist/next at build time.
    __SW_MANIFEST: (PrecacheEntry | string)[] | undefined;
  }
}

declare const self: ServiceWorkerGlobalScope;

const serwist = new Serwist({
  precacheEntries: self.__SW_MANIFEST,
  skipWaiting: true,
  clientsClaim: true,
  navigationPreload: true,
  // defaultCache: StaleWhileRevalidate for /_next/static + static assets,
  // NetworkFirst for navigations (safe for cookie auth), SWR for images/fonts.
  runtimeCaching: defaultCache,
});

serwist.addEventListeners();
```

- [ ] **Step 3: Wire Serwist into next.config.ts**

Replace `next.config.ts` with:
```ts
import type { NextConfig } from "next";
import withSerwistInit from "@serwist/next";

const nextConfig: NextConfig = {
  /* config options here */
};

const withSerwist = withSerwistInit({
  swSrc: "app/sw.ts",
  swDest: "public/sw.js",
  // Disable in dev to avoid stale-cache confusion during local work.
  disable: process.env.NODE_ENV === "development",
});

export default withSerwist(nextConfig);
```

- [ ] **Step 4: Add the web manifest**

Create `app/manifest.ts`:
```ts
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Await",
    short_name: "Await",
    description: "Where connections are worth the await.",
    start_url: "/",
    display: "standalone",
    background_color: "#f4f2ea",
    theme_color: "#f4f2ea",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
  };
}
```

- [ ] **Step 5: Generate the manifest PNG icons**

The manifest references `/icon-192.png` and `/icon-512.png` in `public/`. Generate them from the existing art with a one-off command (clay "A." on cream):
```bash
node -e "const sharp=require('sharp');const svg=s=>Buffer.from(`<svg xmlns='http://www.w3.org/2000/svg' width='${s}' height='${s}'><rect width='${s}' height='${s}' fill='#f4f2ea'/><text x='50%' y='50%' text-anchor='middle' dominant-baseline='central' font-family=\"Georgia,'Times New Roman',serif\" font-weight='600' font-size='${Math.round(s*0.55)}' fill='#cc7a57'>A<tspan fill='#cc7a57'>.</tspan></text></svg>`);Promise.all([[192,'public/icon-192.png'],[512,'public/icon-512.png']].map(([s,o])=>sharp(svg(s)).png().toFile(o))).then(()=>console.log('icons written'))"
```
Expected: `public/icon-192.png` and `public/icon-512.png` exist.

- [ ] **Step 6: Add preconnect hints in the root layout**

In `app/layout.tsx`, inside the `<body>` (React 19 hoists `<link>` into `<head>`), add preconnect hints **above** `<AwaitSplash />`:
```tsx
      <body className="min-h-full flex flex-col">
        <link rel="preconnect" href="https://ynfkwndtmoajcmjppftp.supabase.co" crossOrigin="" />
        <link rel="dns-prefetch" href="https://ynfkwndtmoajcmjppftp.supabase.co" />
        <AwaitSplash />
        {children}
      </body>
```
(`app/manifest.ts` is auto-linked by Next — no manual manifest `<link>` needed.)

- [ ] **Step 7: Ignore the generated service worker**

Append to `.gitignore`:
```
# Serwist-generated service worker
/public/sw.js
/public/swe-worker-*.js
```

- [ ] **Step 8: Build and verify the SW is emitted**

Run:
```bash
npm run build
```
Expected: build succeeds; `public/sw.js` is generated (contains a precache manifest). Confirm:
```bash
ls public/sw.js
```
Expected: file exists.

- [ ] **Step 9: Verify the existing suite still passes**

Run:
```bash
npm test
```
Expected: all tests green (69/69). Then `npx tsc --noEmit` → no errors.

- [ ] **Step 10: Commit**

```bash
git add package.json package-lock.json app/sw.ts next.config.ts app/manifest.ts app/layout.tsx public/icon-192.png public/icon-512.png .gitignore
git commit -m "feat(pwa): Serwist service-worker caching + manifest + preconnect"
```

---

### Task 2: Kill the black flash on cold start (native)

The post-splash theme uses a `@null` window background, so the black OS window shows through during the WebView's first-paint gap. Make the gap cream.

**Files:**
- Modify: `android/app/src/main/res/values/styles.xml`
- Modify: `android/app/src/main/java/com/await/com/MainActivity.java`

**Interfaces:**
- Consumes: `@color/await_paper` (already defined in `colors.xml`).
- Produces: nothing other tasks consume.

- [ ] **Step 1: Give the post-splash theme a cream window background**

In `android/app/src/main/res/values/styles.xml`, change the `AppTheme.NoActionBar` block from:
```xml
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
    </style>
```
to:
```xml
    <style name="AppTheme.NoActionBar" parent="Theme.AppCompat.DayNight.NoActionBar">
        <item name="windowActionBar">false</item>
        <item name="windowNoTitle">true</item>
        <item name="android:background">@null</item>
        <!-- Cream window behind the WebView so the first-paint gap is never black. -->
        <item name="android:windowBackground">@color/await_paper</item>
    </style>
```

- [ ] **Step 2: Set the WebView background cream natively**

Replace `android/app/src/main/java/com/await/com/MainActivity.java` with:
```java
package com.await.com;

import android.graphics.Color;
import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        super.onCreate(savedInstanceState);
        // Paint the WebView cream so there's no black frame before the
        // remote page (and the AwaitSplash overlay) first renders.
        if (bridge != null && bridge.getWebView() != null) {
            bridge.getWebView().setBackgroundColor(Color.parseColor("#f4f2ea"));
        }
    }
}
```

- [ ] **Step 3: Commit**

```bash
git add android/app/src/main/res/values/styles.xml android/app/src/main/java/com/await/com/MainActivity.java
git commit -m "fix(android): cream window + WebView background to kill startup black flash"
```

(Verification of the visible result happens on-device in Task 5.)

---

### Task 3: Branded push-notification icon (native)

`AndroidManifest.xml` has no FCM notification-icon meta-data, so background notifications show a generic grey square. Add a white-silhouette small icon + meta-data + tint color.

**Files:**
- Modify: `scripts/gen-art.mjs` (emit `ic_stat_await.png` per density)
- Create: `android/app/src/main/res/drawable-{mdpi,hdpi,xhdpi,xxhdpi,xxxhdpi}/ic_stat_await.png`
- Modify: `android/app/src/main/res/values/colors.xml` (add clay)
- Modify: `android/app/src/main/AndroidManifest.xml` (meta-data)

**Interfaces:**
- Consumes: `mark()` helper in `scripts/gen-art.mjs` (existing).
- Produces: drawable `ic_stat_await` + color `await_clay`, referenced by the manifest.

- [ ] **Step 1: Emit the white-silhouette notification icon from gen-art.mjs**

In `scripts/gen-art.mjs`, after the existing `splash-dark.png` render (before the final `console.log('done')`), add:
```js
// --- Notification small icon (white "A" silhouette on transparent) ---
// Android tints the status-bar icon using its alpha only, so it MUST be a
// solid white glyph on a transparent background. Written straight into the
// Android res tree at each density.
const white = '#ffffff'
const statSizes = [
  ['mdpi', 24],
  ['hdpi', 36],
  ['xhdpi', 48],
  ['xxhdpi', 72],
  ['xxxhdpi', 96],
]
const statDir = 'android/app/src/main/res'
for (const [dpi, px] of statSizes) {
  const svg = mark({ size: px, bg: null, glyph: white, dot: white, fontSize: Math.round(px * 0.78), withDot: false })
  const dir = `${statDir}/drawable-${dpi}`
  fs.mkdirSync(dir, { recursive: true })
  await sharp(Buffer.from(svg)).png().toFile(`${dir}/ic_stat_await.png`)
  console.log(`wrote ${dir}/ic_stat_await.png`)
}
```

- [ ] **Step 2: Run gen-art to produce the icons**

Run:
```bash
node scripts/gen-art.mjs
```
Expected output includes five `wrote android/app/src/main/res/drawable-*/ic_stat_await.png` lines. Verify:
```bash
ls android/app/src/main/res/drawable-xxhdpi/ic_stat_await.png
```
Expected: file exists.

- [ ] **Step 3: Add the clay tint color**

In `android/app/src/main/res/values/colors.xml`, add the clay color inside `<resources>`:
```xml
    <!-- Notification accent (tints the small icon + colored line). -->
    <color name="await_clay">#cc7a57</color>
```

- [ ] **Step 4: Register the notification icon + color in the manifest**

In `android/app/src/main/AndroidManifest.xml`, add these two `<meta-data>` elements inside `<application>` (e.g. just after the `<provider>` block, before `</application>`):
```xml
        <!-- FCM: brand the system-tray notification (small icon + tint). -->
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_icon"
            android:resource="@drawable/ic_stat_await" />
        <meta-data
            android:name="com.google.firebase.messaging.default_notification_color"
            android:resource="@color/await_clay" />
```

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-art.mjs android/app/src/main/res/drawable-mdpi/ic_stat_await.png android/app/src/main/res/drawable-hdpi/ic_stat_await.png android/app/src/main/res/drawable-xhdpi/ic_stat_await.png android/app/src/main/res/drawable-xxhdpi/ic_stat_await.png android/app/src/main/res/drawable-xxxhdpi/ic_stat_await.png android/app/src/main/res/values/colors.xml android/app/src/main/AndroidManifest.xml
git commit -m "feat(push): branded FCM notification small icon + clay tint"
```

(On-device confirmation in Task 5.)

---

### Task 4: Enlarge the "A." glyph (art)

"+1px" on a 1024 canvas is invisible — bump the glyph meaningfully and regenerate launcher/adaptive/splash assets.

**Files:**
- Modify: `scripts/gen-art.mjs` (fontSize values)
- Regenerated: `android` mipmaps + adaptive icon + splash (via `@capacitor/assets`)

**Interfaces:**
- Consumes: nothing new.
- Produces: regenerated icon/splash PNGs in the Android res tree.

- [ ] **Step 1: Increase the glyph font sizes**

In `scripts/gen-art.mjs`:
- Adaptive-icon foreground line — change `fontSize: 430` to `fontSize: 480`:
```js
await render(mark({ size: 1024, bg: null, glyph: clay, dot: clay, fontSize: 480 }), 'icon-foreground.png')
```
- Full-bleed icon line — change `fontSize: 560` to `fontSize: 620`:
```js
await render(mark({ size: 1024, bg: cream, glyph: clay, dot: clay, fontSize: 620 }), 'icon-only.png')
```
(Leave the `splash` `fontSize: 300` as-is — the splash wordmark is "Await." and already reads fine.)

- [ ] **Step 2: Regenerate source art**

Run:
```bash
node scripts/gen-art.mjs
```
Expected: `resources/icon-foreground.png` and `resources/icon-only.png` rewritten (plus the Task-3 stat icons).

- [ ] **Step 3: Fan out to Android densities + adaptive icon + splash**

Run:
```bash
npx capacitor-assets generate --android
```
Expected: updates `android/.../mipmap-*/ic_launcher*.png`, `mipmap-anydpi-v26` adaptive XML stays, and splash drawables.

- [ ] **Step 4: Eyeball the rendered launcher icon**

Open `android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png` (or `ic_launcher.png`) and confirm the "A." is visibly larger and clearly legible. If still too small, raise the foreground `fontSize` further (e.g. 510) and repeat Steps 2–3.

- [ ] **Step 5: Commit**

```bash
git add scripts/gen-art.mjs resources android/app/src/main/res/mipmap-* android/app/src/main/res/drawable*/splash.png
git commit -m "feat(icon): enlarge the A. glyph for legibility"
```

---

### Task 5: Build the signed APK and verify on-device

Syncs web + native config into the Android project, builds the signed release APK here, and lists the on-device acceptance checks.

**Files:**
- No source changes — build only.

**Interfaces:**
- Consumes: all prior tasks. Requires `android/keystore.properties` to exist (signed build).

- [ ] **Step 1: Sync Capacitor**

Run:
```bash
npx cap sync android
```
Expected: "Sync finished" with the Android platform updated. (No `capacitor.config.ts` change, but sync copies plugins + config.)

- [ ] **Step 2: Build the signed release APK**

Run (Windows / this env):
```bash
cd android && ./gradlew.bat assembleRelease
```
Expected: `BUILD SUCCESSFUL`. APK at `android/app/build/outputs/apk/release/app-release.apk`.

If the gradle toolchain fails headless (no JDK/Android SDK on PATH), STOP and report — fall back to giving the user exact Android Studio "Build > Generate Signed Bundle / APK" steps.

- [ ] **Step 3: Confirm the APK exists and is signed**

Run:
```bash
ls -la android/app/build/outputs/apk/release/app-release.apk
```
Expected: file exists (~4–5 MB).

- [ ] **Step 4: Deploy the web app (so the SW is live for the WebView)**

The PWA caching only helps once the service worker is served from the deployed site. Push to `master` (Vercel auto-deploys):
```bash
git push origin master
```
Then confirm `https://techdate-eta.vercel.app/sw.js` returns 200.

- [ ] **Step 5: On-device acceptance (user)**

Sideload `app-release.apk` and confirm:
- **No black flash** on cold start — cream straight through to the "Await." animation.
- **Faster repeat launch** — close fully and reopen; 2nd launch noticeably quicker (SW-cached assets).
- **Push icon** — trigger a notification (Ping/message/Gideon); status bar + notification show the white "A." silhouette with clay tint, not a grey square.
- **Bigger "A."** — launcher icon glyph is clearly legible.

- [ ] **Step 6: Update OKF memory**

Update `.knowledge/arch-push.md` (startup splash + icon + new PWA-caching note), refresh its line in `.knowledge/index.md`, and add a dated entry to `.knowledge/log.md`. Run `/okf-sync` for the batch.

---

## Notes on testing approach

These changes are configuration, native, CSS, and asset work — not unit-testable with Vitest. The verification cycle for each task is **build + on-device observation** rather than red-green-refactor. The one hard automated gate is Task 1 Step 9: the existing 69-test suite and `tsc` must stay green after the web changes. Everything else is verified by the build succeeding (Tasks 1, 5) and by the on-device acceptance checklist (Task 5 Step 5).
