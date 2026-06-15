# Plan: (a) public post pages + (b) Gideon feed freshness

Two changes from the user-acquisition debate. Decisions locked:
- **(a) `/posts/<slug>` public; `/users/<username>` stays auth-only** (privacy for the future matchmaking/dating pivot).
- **(b) Gideon: fetch fresh HN stories (last 7 days) + rolling 30-day prune of old Gideon posts; keep 2 posts/genre.**

---

## (a) Make post detail pages publicly viewable

**Why:** every shared post link (Reddit/X/WhatsApp) currently 302s to `/login`. Public read = the acquisition surface. Logged-out visitors see the full thread (read-only) + a join CTA.

**Three auth gates to open + component changes:**

1. **`proxy.ts`** (middleware) — currently redirects all non-auth routes to `/login` when logged-out.
   - Add `/posts` to the public allow-list: `isPublic = startsWith('/login' | '/onboarding' | '/posts')`.
   - Keep the `user && pathname === '/'` → `/feed` redirect.
   - `/users` deliberately NOT added (stays private).

2. **`app/(app)/layout.tsx`** — currently `if (!user) redirect('/login')` + profile fetch + Header/Navbar.
   - Read `x-pathname`; `isPublicPath = pathname.startsWith('/posts')`.
   - If `!user && isPublicPath` → render a **minimal public shell** (Await wordmark + Log in / Sign up buttons; no profile fetch, no StreakPing, no bottom Navbar).
   - If `!user && !isPublicPath` → redirect `/login` (defensive; proxy already blocks).
   - If `user` → existing behavior unchanged (full chrome, trial gate). Logged-in UX is preserved.

3. **`app/(app)/posts/[id]/page.tsx`** — currently `if (!user) redirect('/login')`.
   - Remove the redirect; allow `user === null`.
   - Compute like/bookmark state only when `user` exists (else empty).
   - Guard the owner/safety menu block with `user && …`.
   - Compute `isAuthed = !!user`; pass to children.
   - Add a guest CTA banner ("Join the conversation — Sign up / Log in") shown only when `!isAuthed`.

4. **`components/feed/PostActions.tsx`** — add `isAuthed?: boolean` (default true).
   - When `!isAuthed`: render the like count read-only + a "Log in to like / save" link to `/login` (the like/bookmark POST routes 401 for guests).

5. **`components/feed/CommentSection.tsx`** — derive `isAuthed = !!currentUserId` (guests get `currentUserId=''`).
   - Comments already load via a public GET — keep showing them read-only.
   - When `!isAuthed`: replace the compose box (and reply inputs) with a "Log in to join the discussion" CTA. Delete/reply already hide when `currentUserId` doesn't match.

6. **New `components/layout/PublicHeader.tsx`** (or inline in layout) — wordmark + Log in / Sign up. Small.

**Out of scope:** `/users` public profiles (privacy), comments posting by guests, any SEO/OG-meta work (separate later task).

**Verify:** `npx tsc --noEmit` + `npm run build`; reason through the logged-out path (no local env to fully prerender). Redeploy to Vercel (middleware + pages).

---

## (b) Gideon feed freshness (keep 2/genre, NO pruning)

**Why:** HN fetch pulls all-time top + dedupes by URL forever → sticky top items keep getting skipped, net-new → ~0, so few new posts arrive and the feed goes stale.

**Decision: do NOT delete/prune any Gideon posts — they all stay.** We only fix the *intake* so every run brings genuinely fresh content; old posts simply remain in the feed.

1. **`gideon/sources/hackernews.py`** — add a recency window so each run pulls *fresh* popular stories.
   - `import time`; `cutoff = int(time.time()) - 7*86400`.
   - `numericFilters: f"points>10,created_at_i>{cutoff}"`.
   - Bump candidate `limit` 8 → 12 for a wider fresh pool.

2. Keep `MAX_POSTS_PER_GENRE = 2`. dev.to unchanged (`top` is already recent).

**No prune, no rolling delete.** Scheduled runs continue to ONLY insert (dedup by URL); they never delete. The full `GIDEON_RESET` reset still exists for manual use only. Nothing is auto-removed.

**Verify:** `python -m py_compile`. Takes effect on the next scheduled run (or a manual non-reset dispatch). No DB migration, no reset needed.

---

## Rollout order
1. Implement (a) → tsc + build → commit/push → `vercel deploy --prod`.
2. Implement (b) → py_compile → commit/push (applies next scheduled run; optional manual non-reset dispatch to apply now).
3. Update README/AGENT.md (public-posts behavior + Gideon freshness/prune).
