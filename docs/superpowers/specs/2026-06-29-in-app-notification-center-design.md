# In-App Notification Center — Stored Events Design

**Date:** 2026-06-29
**Status:** Approved (design), pending implementation plan

## Problem

Push notifications (new Ping, Ping accepted, new message, Gideon posts) are delivered to the phone but never appear in the app's in-app notification center (the bell). The bell (`lib/notifications.ts::getNotifications`) is **derived purely from `posts` by the user's Peers** — it has no knowledge of Ping/accept/message/Gideon events. The user wants every notable event to show in the bell "like usual notifications," in addition to phone push.

## Goal

Every event that triggers a phone push — plus Peer posts — appears in the in-app notification center. Push and in-app notifications share a single source of truth so they cannot drift.

## Approach: stored `notifications` table (Approach A)

Replace the derived model with a stored notifications table. A single `notify()` helper writes a notification row **and** fires the push at each event site. The bell reads from one table.

Rejected alternatives:
- **B (extend derivation):** 5+ live queries per bell load, no stable id for message notifications, dismissal model (`post_id`) doesn't generalize. Brittle/slow.
- **C (hybrid stored + derived):** two consistency models, merge/dedupe complexity.

## Live DB facts (verified 2026-06-29 against prod)

- No `notifications` table exists.
- No `requests` table — Pings/accepts are modeled on `swipes(direction)` + `matches`.
- `matches(id, user1_id, user2_id, created_at)`
- `swipes(id, swiper_id, swiped_id, direction, created_at)`
- `messages(id, match_id, sender_id, content, created_at)`
- `dismissed_notifications(user_id, post_id, dismissed_at)` — keyed by `post_id` only.
- `users.last_notifications_seen` exists (current unread mechanism — **retained**).

## Components

### 1. Migration `028_notifications.sql`

```sql
create table notifications (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,   -- recipient
  type         text not null,        -- 'ping' | 'ping_accepted' | 'message' | 'peer_post' | 'gideon_post'
  title        text not null,
  body         text,
  route        text,                 -- deep-link target (same routes push uses)
  actor_id     uuid references users(id) on delete cascade,   -- who triggered (null for gideon)
  post_id      uuid references posts(id) on delete cascade,   -- for post/gideon (null otherwise)
  dismissed_at timestamptz,          -- null = visible
  created_at   timestamptz not null default now()
);
create index notifications_user_created_idx on notifications (user_id, created_at desc);

alter table notifications enable row level security;
create policy notifications_select_own on notifications for select using (user_id = auth.uid());
create policy notifications_update_own on notifications for update using (user_id = auth.uid());
create policy notifications_delete_own on notifications for delete using (user_id = auth.uid());
-- No end-user INSERT policy: rows are written for OTHER users via the service-role admin client.

drop table if exists dismissed_notifications;
```

- **Single-column PK (`id`)** deliberately avoids the two-FK composite-PK PostgREST junction bug that required migration 023 on `dismissed_notifications`.
- Dropping `dismissed_notifications` removes that junction table entirely — the embed-ambiguity concern disappears. All code referencing it must be removed (see §6 risks).

### 2. `notify()` helper — `lib/notifications/notify.ts`

```ts
notify(userId: string, opts: {
  type: 'ping' | 'ping_accepted' | 'message' | 'peer_post' | 'gideon_post'
  title: string
  body?: string
  route?: string
  actorId?: string
  postId?: string
  push?: boolean   // default true
}): Promise<void>
```

- Inserts a `notifications` row via the **service-role admin client** (`lib/supabase/admin.ts::createAdminClient`) — rows are for other users, so RLS must be bypassed.
- Insert is **awaited** (fast indexed insert; guarantees the bell row persists). Push is then fired **deferred/fire-and-forget** via existing `lib/push/send.ts::sendPush` — matches the current `void Promise.resolve().then(...)` pattern at call sites.
- Wrapped in try/catch — **never throws** to the caller.
- `push:false` → bell-only (used for Peer posts).

### 3. Event wiring (replace the 4 existing `sendPush` call sites + add post fan-out)

| Site | Call |
|------|------|
| `app/api/swipes/route.ts` (right-swipe) | `notify(swiped_id, {type:'ping', title:'New Ping', body:'{actor} pinged you', route:'/discover', actorId})` |
| `app/api/requests/route.ts` (accept→match) | `notify(requester_id, {type:'ping_accepted', title:'Ping accepted', route:'/messages/{matchId}', actorId})` |
| `app/api/messages/route.ts` | `notify(other, {type:'message', title:'New message', body:snippet≤80, route:'/messages/{matchId}', actorId:sender})` |
| `app/api/internal/gideon-push/route.ts` | per matching user: `notify(user, {type:'gideon_post', title, body, route:'/posts/{id}', postId, push:true})` |
| Post creation route (Peer fan-out, **new**) | per Peer of author: `notify(peer, {type:'peer_post', title:postTitle, route:'/posts/{slug}', postId, actorId:author, push:false})` |

- Peer posts are **bell-only (no push)** — preserves today's no-spam behavior (Peer posts have never pushed).
- All sites keep responses non-blocking: the awaited insert is cheap; push stays deferred.

### 4. Read path — rewrite `lib/notifications.ts::getNotifications`

- Single query: `notifications` where `user_id = me and dismissed_at is null`, order by `created_at desc`, limit 30, embed actor (`users(id, name, photo_url)`) via `actor_id`.
- Unread: **reuse `last_notifications_seen`** — `isNew = created_at > lastSeen`; `unread = count(isNew)`. `MarkNotificationsSeen` flow unchanged.
- Returns items: `{ id, type, title, body, route, actorName, actorPhoto, created_at, isNew }`.
- Remove all `posts`-derivation and `dismissed_notifications` logic.

### 5. UI — `components/notifications/NotificationsList.tsx`, `components/layout/NotifBell.tsx`

- Render per `type`: icon/glyph + title/body text, linking to `item.route` (fallback to `/posts/{slug}` no longer needed — route is stored).
- Actor avatar from `actorName`/`actorPhoto` when present.
- Dismiss keyed by **notification `id`**: `app/api/notifications/dismiss/route.ts` sets `dismissed_at = now()` on the caller's own row (RLS-guarded update), replacing the `dismissed_notifications` insert.
- Swipe-to-delete / tap-to-reveal interactions unchanged in mechanism; only the id and endpoint payload change.

### 6. Risks / call-outs

- **Dropping `dismissed_notifications`:** grep all references (dismiss route, `getNotifications`, any feed code, tests) and remove/rewrite before applying. Migration 023's de-junction fix becomes moot.
- **Admin-client inserts:** depends on `SUPABASE_SERVICE_ROLE_KEY` being the correct service_role value in prod (this was previously misconfigured — see arch-push open thread). Verify before relying on the send path.
- **Post fan-out write amplification:** one row per Peer per post. Acceptable at current scale; FCM-topics / digest is future work (already noted for push).
- **Migration ordering:** apply `028` to prod via the `aws-1-ap-south-1` session pooler (IPv4 path; Supabase direct host is IPv6-only).

## Testing

- `tests/lib/notifications/notify.test.ts` — inserts row + calls sendPush; `push:false` skips push; never throws on DB/push failure.
- Rewrite `getNotifications` tests for the new stored shape + `isNew` via `last_notifications_seen`.
- Update `tests/lib/api/push-hooks.test.ts` — call sites now invoke `notify()` (still pushes).
- Dismiss API test — sets `dismissed_at` on own row; cannot dismiss others' rows (RLS).
- Full suite must stay green; `tsc` clean.

## Out of scope

- Per-row read state (using `last_notifications_seen` instead).
- iOS push (deliberately out of scope project-wide).
- Notification mute/digest/preferences.
