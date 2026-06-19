---
type: architecture
title: Notifications
description: Derived from posts; deletable; dismissals stored in a DB table
tags: [notifications, dismiss, postgrest]
timestamp: 2026-06-18T00:00:00Z
---

# Notifications

Routes: `app/(app)/notifications`, `app/api/notifications`; UI in `components/notifications`; logic in `lib/notifications.ts`.

- **Derived, not stored as events:** notifications are computed from posts (and related activity), not written to a dedicated notifications table.
- **Dismissals persist:** dismissed notifications are recorded in a DB table (`022_dismissed_notifications`). Dismiss API: `app/api/notifications/dismiss/route.ts`.
- **Deletable UI:** swipe-to-delete on mobile; tap-to-reveal View/Delete on desktop (`components/notifications/NotificationsList.tsx`).
- **Seen state:** `014_notifications_seen` + `components/layout/MarkNotificationsSeen.tsx`; bell in `components/layout/NotifBell.tsx`.
- **PostgREST gotcha (resolved):** giving `dismissed_notifications` a composite PK of exactly two FKs made it look like an m2m junction, so `posts → users` embeds turned ambiguous and feed/notifications went empty. Migration `023_fix_dismissed_notifications_junction` dropped the `user_id` FK to de-junction. Rule: never give a join table a composite PK of exactly two FKs. See [database](arch-database.md), [feed](arch-feed.md).
