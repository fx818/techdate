# techDate Android — Setup Checklist

## Already done in the repo (no action needed)
- ✅ Capacitor shell + `android/` native project generated.
- ✅ Deploy URL baked into `capacitor.config.ts` (`https://techdate-eta.vercel.app`) and synced into the native project. Override only if the domain changes: `CAP_SERVER_URL=https://… npx cap sync android`.
- ✅ Google-Services gradle plugin + classpath wired (FCM-ready once `google-services.json` is added).
- ✅ Release signing wired to read `android/keystore.properties` (gitignored) — once you create that file + the keystore, `./gradlew assembleRelease` produces a **signed** APK directly.

## What only YOU can do (needs your accounts / a local Android toolchain)
These can't be automated here: they require interactive login to **your** Google/Firebase + Supabase, and a JDK + Android SDK on your machine.

---

### Step 1 — Apply the Supabase migration
Supabase dashboard → **SQL Editor** → run `supabase/migrations/026_device_tokens.sql` (creates `device_tokens` + RLS + index).

### Step 2 — Create a free Firebase project + `google-services.json`
1. <https://console.firebase.google.com> → create project (free Spark plan).
2. **Add app → Android**, package name **`com.anurag.techdate`** (must match `appId`).
3. Download **`google-services.json`** → place at `android/app/google-services.json`.

### Step 3 — Get the FCM service-account key (server creds)
Firebase Console → Project Settings → **Service Accounts** → **Generate new private key** (JSON). Use its `project_id` / `client_email` / `private_key` below.

### Step 4 — Set server env vars (Vercel project settings)
| Variable | Value |
|---|---|
| `FCM_PROJECT_ID` | service-account JSON `project_id` |
| `FCM_CLIENT_EMAIL` | service-account JSON `client_email` |
| `FCM_PRIVATE_KEY` | service-account JSON `private_key` (keep the `-----BEGIN…` and `\n`s) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API → service_role key |
| `GIDEON_PUSH_SECRET` | any long random string — **also** add it as a GitHub Actions secret of the same name |
| `APP_URL` | `https://techdate-eta.vercel.app` (no trailing slash) — also a GitHub Actions secret |

> `APP_URL` + `GIDEON_PUSH_SECRET` must exist as **GitHub repo secrets** too (the Gideon cron reads them) — Settings → Secrets and variables → Actions.

### Step 5 — Create the signing keystore (one-time, free; needs a JDK)
```bash
cd android
keytool -genkey -v -keystore techdate.keystore -alias techdate -keyalg RSA -keysize 2048 -validity 10000
cp keystore.properties.example keystore.properties   # then edit the passwords
```
Fill `android/keystore.properties` with your store/key passwords. **Keep the keystore + passwords forever** — the same key must sign every update.

### Step 6 — Build the signed APK (needs Android Studio / Android SDK)
```bash
CAP_SERVER_URL=https://techdate-eta.vercel.app npx cap sync android   # only if config changed
cd android && ./gradlew assembleRelease
# → android/app/build/outputs/apk/release/app-release.apk  (signed, because keystore.properties is present)
```
Or open `android/` in Android Studio → **Build → Generate Signed Bundle / APK → APK → release**.

### Step 7 — Sideload + verify
```bash
adb install -r android/app/build/outputs/apk/release/app-release.apk
```
Allow "Install from unknown sources" once. Then: log in → grant the Notifications permission → from another account send a Ping (lock-screen push → taps to `/discover`), send a message (→ `/messages/[matchId]`), and confirm a genre-matched Gideon post pushes to `/feed` after a cron run.

---

## Notes
- **iOS** is out of scope (Mac + $99/yr Apple account). **Play Store** publishing is a one-time $25 fee; until then distribute the APK directly.
- Updating: bump `versionCode` in `android/app/build.gradle`, rebuild, `adb install -r` (preserves data as long as the signing key is unchanged).
