# Context

**Current Task:** Polished networking UX + fixed two production bugs (empty feed, idle session) and the streak system. All deployed.

**Key Decisions:**
- Naming: Chats→Peers (with peer search), People nav tab→Discover (avoids People/Peers homophone); `/messages` stays "chat".
- Notifications are derived from posts, so deletion is recorded in `dismissed_notifications` (mig 022). Mig 022's composite-FK PK made it a PostgREST posts↔users junction → ambiguous embeds → app-wide empty feed/notifications; fixed by dropping the `user_id` FK in mig 023. Documented the trap in AGENT.md.
- Streak day boundary is IST (not UTC); displayed streak corrected live via `lib/streak.ts::effectiveStreak`.

**Next Steps:**
- Verify on prod: idle ~1h then navigate (SessionWatcher), streak rolls at IST midnight, deleted notifications stay gone.
- Optional: throttled `last_active` bump on focus for fresher "active recently".
- Optional: discovery search on `/discover` for finding new users.
