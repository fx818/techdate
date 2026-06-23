# techDate Android — Manual Setup Checklist

Everything below runs on **your local machine**. None of it can be automated in CI
because it needs Android Studio, a Firebase account, and a signing keystore.

---

## Prerequisites

- [ ] Node 18+ and this repo checked out locally.
- [ ] **Android Studio** installed (bundles the Android SDK and JDK — both free).
- [ ] Next.js app deployed at a public HTTPS URL (e.g. Vercel free tier).
      Note that URL — it is used in several steps below.

---

## Step 1 — Apply the Supabase migration

1. Open the Supabase dashboard for this project → **SQL Editor**.
2. Run `supabase/migrations/026_device_tokens.sql` (creates the `device_tokens`
   table + RLS policy + index).

---

## Step 2 — Set environment variables on the server

Add these to your Vercel project (or wherever the Next.js app is deployed):

| Variable | Value |
|---|---|
| `FCM_PROJECT_ID` | from the Firebase service-account JSON (`project_id`) |
| `FCM_CLIENT_EMAIL` | from the Firebase service-account JSON (`client_email`) |
| `FCM_PRIVATE_KEY` | from the Firebase service-account JSON (`private_key`), including `-----BEGIN...` |
| `SUPABASE_SERVICE_ROLE_KEY` | from Supabase → Settings → API → service_role key |
| `GIDEON_PUSH_SECRET` | any long random string — also set in GitHub Actions secret of the same name |
| `APP_URL` | your public deploy URL, e.g. `https://tech-date.vercel.app` (no trailing slash) |

---

## Step 3 — Create a free Firebase project and get google-services.json

1. Go to <https://console.firebase.google.com> and create a new project (free Spark plan).
2. Inside the project: **Add app → Android**.
   - Package name: `com.anurag.techdate`  ← must match `capacitor.config.ts` `appId`.
3. Download the generated **`google-services.json`**.
4. Place it at `android/app/google-services.json` in this repo.

---

## Step 4 — Get the FCM service-account key (for the server)

1. Firebase Console → Project Settings → **Service Accounts** tab.
2. Click **Generate new private key** → downloads a JSON file.
3. Copy `project_id`, `client_email`, and `private_key` into the server env vars
   from Step 2.

---

## Step 5 — Add the Android platform (first time only)

Run once in the repo root after `npm install`:

```bash
# Set the deploy URL so the Capacitor config is correct before adding android
CAP_SERVER_URL=https://YOUR_DEPLOY_URL npx cap add android
```

This creates the `android/` native project.  If you already have `android/`,
skip this step and go to Step 6.

> On Windows PowerShell:
> ```powershell
> $env:CAP_SERVER_URL="https://YOUR_DEPLOY_URL"; npx cap add android
> ```

---

## Step 6 — Sync Capacitor

After any change to `capacitor.config.ts` or Capacitor plugins, run:

```bash
CAP_SERVER_URL=https://YOUR_DEPLOY_URL npx cap sync android
```

---

## Step 7 — Create a signing keystore (one-time, free)

```bash
keytool -genkey -v -keystore techdate.keystore \
  -alias techdate \
  -keyalg RSA \
  -keysize 2048 \
  -validity 10000
```

**Keep this file and the passwords safe.** The same keystore must sign every
future build — losing it means uninstalling the old app before sideloading an update.

---

## Step 8 — Build a signed release APK

**Option A — Android Studio (GUI):**
1. Open `android/` in Android Studio.
2. **Build → Generate Signed Bundle / APK → APK**.
3. Select the `techdate.keystore`, enter alias + passwords, choose **release**.
4. Output: `android/app/release/app-release.apk`.

**Option B — CLI:**
```bash
cd android
./gradlew assembleRelease
# APK at android/app/build/outputs/apk/release/app-release-unsigned.apk
# (sign it with apksigner if not wired into build.gradle)
```

---

## Step 9 — Sideload the APK onto an Android phone

```bash
adb install android/app/release/app-release.apk
```

Or transfer the APK file to the phone and open it from Files.
Allow **"Install from unknown sources"** when prompted (one-time per source app).

---

## Step 10 — Verify push end-to-end

1. Launch the app, log in.
2. When prompted, **grant the Notifications permission**.
3. From another account, send a Ping to the logged-in user → a lock-screen
   notification should appear within seconds.
4. Tap the notification → the app should open and navigate to `/discover`.
5. Repeat with a message → notification should deep-link to `/messages/[matchId]`.
6. Wait for the next Gideon cron run (every 4h) or trigger it manually → a
   genre-matched Gideon post should produce a lock-screen push to `/feed`.

---

## Notes

- **iOS** is out of scope: building/sideloading requires a Mac and $99/yr Apple
  Developer account. Revisit when ready to pay.
- **Play Store** publishing costs a one-time $25 Google Play developer fee.
  Until then, distribute APKs directly via `adb` or file transfer.
- To update the app: bump the `versionCode` in `android/app/build.gradle`, re-sign,
  and `adb install -r app-release.apk` (the `-r` flag reinstalls without uninstalling,
  preserving app data, as long as the signing key is the same).
