---
type: architecture
title: Feed & Posts
description: Posts/comments/likes with trigger-maintained counts, saved/bookmarks, Gideon seeds
tags: [feed, posts, comments, likes, saved]
timestamp: 2026-06-19T00:00:00Z
---

# Feed & Posts

The discussion surface. Routes: `app/(app)/feed`, `app/(app)/posts`, `app/(app)/saved`; components under `components/feed`.

- **Posts / comments / likes** live in `002_posts_comments_likes`. `likes_count` and `comments_count` are auto-incremented by DB triggers — do not hand-maintain them.
- Each like/comment/post awards XP via `awardXp` and updates the user's [interest_vector](arch-matching.md).
- **Feed source filter default = `all`** (community + Gideon), set in `app/(app)/feed/page.tsx` and `components/feed/FeedFilters.tsx`. Changed from `community` on 2026-06-19 so new users never see an empty feed during cold-start; users can still narrow to Community-only.
- **First-run nudge:** `components/feed/GettingStarted.tsx` shows for low-activity users (xp < 25, dismissible via localStorage) with CTAs to post (fires `await:new-post` window event that `CreatePost` listens for) or visit Discover.
- **Rate limits:** post and comment creation are capped per user via `rateLimit()` (`lib/redis/client.ts`) — see [moderation](arch-moderation.md).
- **Saved / bookmarks:** migration `013_images_bookmarks`.
- **Gideon posts:** rows with `is_gideon=true` are seeded by the cron agent — see [gideon](arch-gideon.md). Now surfaced by default; founder-seeded human posts still matter for real discussion.
- **PostgREST embed caution:** a junction table once made `posts → users` embeds ambiguous and emptied the feed; fixed by migration 023. See [notifications](arch-notifications.md) and [database](arch-database.md).
