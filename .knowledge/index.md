# Knowledge Index

> Read this first. Open a concept file only when your task touches that area.
> Cross-session memory in Open Knowledge Format. Concepts are current truth (overwritten); `log.md` is history (appended).

**Await** — Next.js 16 + Supabase + Redis app: a verified-techie discussion community with lightweight professional networking (Ping → Peer). Tests: Vitest.

## Concepts
- [Glossary](glossary.md) — project vocabulary (Ping, Peer, Discover, Gideon, …) — 2026-06-18
- [Auth & Sessions](arch-auth.md) — cookie auth, proxy.ts guard, real email verification, idle keep-alive — 2026-06-19
- [Feed & Posts](arch-feed.md) — posts/comments/likes, default source+genre=all (all posts), first-run nudge, Gideon seeds — 2026-06-23
- [Matching](arch-matching.md) — interest_vector + cosine candidate scoring — 2026-06-18
- [Peers & Connections](arch-peers.md) — Ping → accept → Peer; Discover, requests, chat — 2026-06-19
- [Moderation & Admin](arch-moderation.md) — blocks, reports, rate limits, founder triage + kill-test dashboards — 2026-06-19
- [Notifications](arch-notifications.md) — derived from posts; deletable; dismissals in DB — 2026-06-18
- [Streaks](arch-streaks.md) — IST day boundary; effectiveStreak reads 0 when stale — 2026-06-18
- [XP System](arch-xp.md) — awardXp ledger + weights; 100-XP unlock now vestigial — 2026-06-18
- [Gideon Agent](arch-gideon.md) — Python cron seeding posts from HN + dev.to + Lobsters — 2026-06-19
- [Database](arch-database.md) — Supabase/Postgres, RLS, migrations 001–026, type-cast + PostgREST gotchas — 2026-06-23
- [Push Notifications](arch-push.md) — FCM HTTP v1; device_tokens + /api/devices; sendPush wired into Pings/messages/Gideon broadcast; Capacitor shell (URL baked, signed-build wired) — 2026-06-24

## Open threads
- okf-memory plugin is being dogfooded here; this bundle is its first real `.knowledge/`.
- `users.dating_unlocked` still vestigial — unused selects removed 2026-06-19; column + awardXp flip remain (drop needs a migration).
- Product roadmap at `docs/strategy/2026-06-19-product-roadmap.md`. Phase 1 launch-blockers largely shipped 2026-06-19. Remaining: Phase 2 GTM/kill-test, Phase 3 features.
- `users.is_admin` must be set manually in DB for any founder account before `/admin/*` works.
- Android app fully implemented 2026-06-23 (branch `mobile-android-app`, not yet merged): push wired into swipes/requests/messages + Gideon broadcast endpoint, `/api/devices` registration, Capacitor `android/` shell + `PushRegistrar`. 69/69 tests green, tsc clean. ✅ deploy URL baked; ✅ **migration 026 applied to prod 2026-06-24** (device_tokens + RLS live; via aws-1-ap-south-1 session pooler — note Supabase direct host is IPv6-only, pooler is the IPv4 path); ✅ rebranded to **Await** / appId **`com.await.com`** (matches Firebase `await-18651`), `google-services.json` committed. ✅ **merged to master + deployed to prod 2026-06-24 — push backend verified LIVE** (`/api/internal/gideon-push` → 200 `{sent:0}`; GIDEON_PUSH_SECRET matches Vercel↔GitHub). Vercel→GitHub git integration now connected (master auto-deploys); deploy is via git push, NOT `vercel --prod` (CLI prod deploy is blocked by harness). **Remaining (manual):** generate keystore + `gradlew assembleRelease` + sideload + grant notif permission to test end-to-end (see `mobile/MOBILE.md`); rotate the leaked Firebase service-account key.
- Brand: product is **Await**. Mobile reconciled 2026-06-24 — Capacitor `appName`=Await, Android appId=`com.await.com`, push copy=Await. (Web repo/URL/Supabase project still named `techdate`; that's infra, intentional.)
