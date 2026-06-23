---
type: architecture
title: Feed & Posts
description: Posts/comments/likes with trigger-maintained counts, saved/bookmarks, Gideon seeds
tags: [feed, posts, comments, likes, saved]
timestamp: 2026-06-23T00:00:00Z
---

# Feed & Posts

The discussion surface. Routes: `app/(app)/feed`, `app/(app)/posts`, `app/(app)/saved`; components under `components/feed`.

- **Posts / comments / likes** live in `002_posts_comments_likes`. `likes_count` and `comments_count` are auto-incremented by DB triggers — do not hand-maintain them.
- Each like/comment/post awards XP via `awardXp` and updates the user's [interest_vector](arch-matching.md).
- **Filters default to `all`/`all`** (`app/(app)/feed/page.tsx`, `components/feed/FeedFilters.tsx`): the landing feed shows every community + Gideon post across all genres, so cold-start users never hit an empty feed. The query is filtered only when a specific source (Community/Gideon) or a specific genre is selected; `profile.genres` seeds the topic chips and CreatePost, not the default query.
- **First-run nudge:** `components/feed/GettingStarted.tsx` shows for low-activity users (xp < 25, dismissible via localStorage) with CTAs to post (fires `await:new-post` window event that `CreatePost` listens for) or visit Discover.
- **Rate limits:** post and comment creation are capped per user via `rateLimit()` (`lib/redis/client.ts`) — see [moderation](arch-moderation.md).
- **Saved / bookmarks:** migration `013_images_bookmarks`.
- **Gideon posts:** rows with `is_gideon=true` are seeded by the cron agent — see [gideon](arch-gideon.md). Now surfaced by default; founder-seeded human posts still matter for real discussion.
- **PostgREST embed caution:** a junction table once made `posts → users` embeds ambiguous and emptied the feed; fixed by migration 023. See [notifications](arch-notifications.md) and [database](arch-database.md).
