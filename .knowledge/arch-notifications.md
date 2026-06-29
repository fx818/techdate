---
type: architecture
title: Notifications
description: Stored, event-sourced bell (table 028); notify() = single source of truth for bell + push; dismissals via dismissed_at
tags: [notifications, notify, push, dismiss, stored, postgrest, rls]
timestamp: 2026-06-29T00:00:00Z
---

# Notifications

Routes: `app/(app)/notifications`, `app/api/notifications`; UI in `components/notifications`; read logic in `lib/notifications.ts`; write helper in `lib/notifications/notify.ts`.

## Stored, event-sourced (rebuilt 2026-06-29)
Previously derived from posts; now **stored**. Every push-worthy event inserts a row into the `notifications` table (migration 028) so the in-app bell and phone push share one source of truth and cannot drift.

- **Table `notifications`** (`028_notifications.sql`): `id` (single-column PK — deliberately NOT a two-FK composite, which recreated the PostgREST junction bug in 023), `user_id` (recipient), `type` (`ping|ping_accepted|message|peer_post|gideon_post`), `title`, `body`, `route` (deep-link, same routes push uses), `actor_id` (who triggered; null for gideon), `post_id` (post/gideon; else null), `dismissed_at` (null = visible), `created_at`. Index `(user_id, created_at desc)`.
- **RLS:** SELECT/UPDATE/DELETE where `user_id = auth.uid()`. **No INSERT policy** — rows are written for *other* users, so inserts go through the service-role admin client (`lib/supabase/admin.ts`), bypassing RLS. Reads/dismiss use the cookie client.
- **`dismissed_notifications` table was DROPPED** in 028 (obsolete — dismissal now sets `notifications.dismissed_at`).

## `notify()` — write path (single source of truth)
`lib/notifications/notify.ts::notify(userId, { type, title, body?, route?, actorId?, postId?, push=true })`:
- **Awaits** the row insert via the admin client (cheap indexed insert → bell never misses an event), then fires `sendPush` **deferred + best-effort**. Never throws.
- `push:false` → bell-only (used for Peer posts, which have never pushed — avoids spam).

## Event sites (call `notify()`, not `sendPush()`)
- `app/api/swipes` right-swipe → `ping` (route `/discover`, actorId=swiper).
- `app/api/requests` accept→match → `ping_accepted` (route `/messages/{matchId}`).
- `app/api/messages` → `message` (body = ≤80-char snippet, route `/messages/{matchId}`). **One bell row per message** (no collapse — future work).
- `app/api/internal/gideon-push` → `gideon_post` per genre-matching user (route `/posts/{id}`, push:true).
- `app/api/posts` POST `after()` → **peer-post fan-out**: one `peer_post` row per Peer of the author (route `/posts/{slug}`, **push:false**). Peers = the author's `matches`.

## Read path
`lib/notifications.ts::getNotifications(supabase, userId)`: single query on `notifications` (own rows, `dismissed_at is null`, newest 30), embeds actor via `actor:users!notifications_actor_id_fkey(...)` — the FK-name hint is **required** because the table has two FKs to `users` (`user_id` + `actor_id`), so an un-hinted embed is ambiguous. Returns `{id, type, title, body, route, actorName, actorPhoto, created_at, isNew}`.
- **Unread/seen:** still via `users.last_notifications_seen` (`014_notifications_seen` + `MarkNotificationsSeen.tsx`); `isNew = created_at > lastSeen`; bell badge in `NotifBell.tsx` reads `unread` from `/api/notifications`. No per-row read state.
- **No block-filtering** in getNotifications (own-row model) — noted as future work.

## Dismiss
`app/api/notifications/dismiss/route.ts` — `POST {id}` sets `dismissed_at = now()` on the caller's own row (RLS + explicit `user_id` filter). UI in `components/notifications/NotificationsList.tsx` (swipe-to-delete mobile; tap-to-reveal View/Delete desktop) sends `{id}` and renders typed title/body, links to `route`, tolerates a null actor (gideon).

See [push](arch-push.md), [database](arch-database.md), [peers](arch-peers.md).
