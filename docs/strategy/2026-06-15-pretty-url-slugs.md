# Pretty URL slugs — implementation plan

**Goal:** replace UUIDs in page URLs with human-readable slugs.

| Route | Before | After | Resolves by |
|---|---|---|---|
| `/users/[id]` | `/users/<uuid>` | `/users/anuragu` | `username` (uuid fallback → redirect) |
| `/posts/[id]` | `/posts/<uuid>` | `/posts/why-rust-is-great` | `slug` (uuid fallback → redirect) |
| `/messages/[matchId]` | `/messages/<uuid>` | `/messages/priya-<uuid>` | trailing uuid in slug |

API routes (`/api/...`) keep UUIDs — internal, unchanged.

## DB (migration 020)
- `users.username text` — unique, NOT NULL, `^[a-z0-9_]{2,30}$`. Backfill from name, dedupe loop.
- `posts.slug text` — unique, NOT NULL. Backfill from title, dedupe loop.

## New: `lib/slug.ts`
`slugify`, `isUuid`, `isValidUsername`, `userHref`, `postHref`, `chatHref`, `matchIdFromSlug`.

## Slug generation on create
- `app/api/posts` POST — slugify(title), append short id on clash.
- `gideon/fetch.py` — same, in Python.

## Username capture
- onboarding: username field + client-side availability check (users table is publicly readable).
- EditProfile: editable username field.

## Resolvers (uuid fallback + canonical redirect)
- `posts/[id]`, `users/[id]`, `messages/[matchId]`.

## Link sites (use helpers + select username/slug)
- profile links: PostCard, posts/[id], matches.
- post links: PostCard (via every list: feed, profile, saved, profile/posts, users/[id]), notifications.
- chat links: matches, PingButton (needs otherUsername prop), RequestList.
- queries to add `username` to `users(...)`: feed, /api/posts, users/[id], profile, profile/posts, saved, posts/[id], matches; add `slug` to notifications post select.

## Out of scope
- `components/dating/MatchModal.tsx` (dead code) left as-is.
