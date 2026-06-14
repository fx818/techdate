# Trust & Safety + Core Features Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add the missing core features to Await — trust & safety (block/report/unmatch), password reset, account deletion, threaded comment replies, public user profiles, edit/delete own content, multiple profile photos, and "active recently" status.

**Architecture:** Next.js 16 App Router + Supabase (Postgres + RLS + Storage) + Upstash Redis. Server components fetch via the anon-key cookie client (`createClient` from `lib/supabase/server`); every server-side query uses the intentional `(supabase as any).from(...)` cast. Cross-user gates that RLS can't express (e.g. "did they block me") use `SECURITY DEFINER` SQL functions, matching the existing `has_right_swipe` / `get_incoming_requests` pattern. New write endpoints are Next route handlers under `app/api/`.

**Tech Stack:** Next.js 16, React, TypeScript, Tailwind v4, Supabase JS (`@supabase/ssr`), lucide-react.

**Verification note (project-specific):** This repo has no component/integration test harness — only `tests/lib/` unit tests for pure functions. So each task is verified by: (1) `npx tsc --noEmit` clean, (2) `npm run build` succeeds, (3) live REST/route smoke checks via the public anon key where applicable, (4) deploy with `npx vercel deploy --prod`. Migrations are applied with `npx supabase db push`. Env vars for local build: set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` to any non-empty placeholder for `tsc`/build (real values live on Vercel).

**Migration numbering:** continue from the latest applied migration (currently `014_notifications_seen.sql`). This plan adds `015`–`019`.

---

## File Structure

**New SQL migrations (`supabase/migrations/`):**
- `015_blocks_reports.sql` — `blocks` + `reports` tables, RLS, `get_blocked_ids()` SECURITY DEFINER fn
- `016_content_ownership.sql` — RLS UPDATE/DELETE policies for `posts` & `comments`; `delete_own_account()` SECURITY DEFINER fn
- `017_profile_photos.sql` — `users.photos text[]`
- (no new migration for replies — schema already supports `comments.parent_id`)
- (no new migration for active-recently — `users.last_active` already exists)

**New API routes (`app/api/`):**
- `block/route.ts` — POST toggle block / DELETE unblock
- `report/route.ts` — POST a report (user | post | comment)
- `matches/[id]/route.ts` — DELETE unmatch
- `posts/[id]/route.ts` — PATCH edit / DELETE own post
- `posts/[id]/comments/[commentId]/route.ts` — DELETE own comment
- `account/route.ts` — DELETE own account
- `auth/reset/route.ts` — POST send reset email (or done client-side; see Task 8)

**New pages (`app/(app)/` and `app/(auth)/`):**
- `app/(app)/users/[id]/page.tsx` — public user profile
- `app/(auth)/reset-password/page.tsx` — set a new password (recovery landing)

**New / modified components (`components/`):**
- `components/ui/ActionMenu.tsx` — reusable "⋯" overflow menu (block/report/edit/delete)
- `components/feed/CommentSection.tsx` — threaded replies + delete
- `components/feed/PostOwnerMenu.tsx` — edit/delete for own post (detail page)
- `components/dating/SwipeDeck.tsx` / `ProfileCard.tsx` — photo carousel + active status
- `components/profile/EditProfile.tsx` — multi-photo upload
- `components/layout/Header.tsx` — (already updates last_active via Task 13's ping)

---

## Task 1: Blocks & Reports schema (migration 015)

**Files:**
- Create: `supabase/migrations/015_blocks_reports.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Blocks: blocker no longer sees / can be contacted by blocked (both directions enforced in app)
create table if not exists public.blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_id uuid not null references public.users(id) on delete cascade,
  blocked_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique(blocker_id, blocked_id)
);
alter table public.blocks enable row level security;

create policy "Users manage own blocks"
  on public.blocks for all
  using (auth.uid() = blocker_id)
  with check (auth.uid() = blocker_id);

create index if not exists blocks_blocker_idx on public.blocks(blocker_id);
create index if not exists blocks_blocked_idx on public.blocks(blocked_id);

-- Reports: abuse reports on a user, post, or comment
create table if not exists public.reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid not null references public.users(id) on delete cascade,
  target_type text not null check (target_type in ('user','post','comment')),
  target_id uuid not null,
  reason text not null,
  details text,
  created_at timestamptz not null default now()
);
alter table public.reports enable row level security;

create policy "Users can file reports"
  on public.reports for insert
  with check (auth.uid() = reporter_id);

create policy "Users can read own reports"
  on public.reports for select
  using (auth.uid() = reporter_id);

-- Returns the set of user ids that are blocked in EITHER direction relative to
-- the caller (I blocked them, or they blocked me). SECURITY DEFINER so the
-- "they blocked me" half is visible despite RLS. Returns ids only — no data leak.
create or replace function public.get_blocked_ids()
returns table (user_id uuid)
language sql security definer set search_path = public as $$
  select blocked_id from public.blocks where blocker_id = auth.uid()
  union
  select blocker_id from public.blocks where blocked_id = auth.uid();
$$;

grant execute on function public.get_blocked_ids() to authenticated, anon;
```

- [ ] **Step 2: Apply the migration**

Run: `npx supabase db push`
Expected: `Applying migration 015_blocks_reports.sql... Finished supabase db push.`

- [ ] **Step 3: Smoke-test the function exists (anon → empty result, no error)**

Run (PowerShell): `curl.exe -s -X POST "$REST/rpc/get_blocked_ids" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" --data "{}"`
(`$REST` = `https://ynfkwndtmoajcmjppftp.supabase.co/rest/v1`, `$ANON` = the public anon key.)
Expected: `[]`

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/015_blocks_reports.sql
git commit -m "feat: blocks + reports tables, get_blocked_ids() RLS-bypass helper"
```

---

## Task 2: Block / Unblock API

**Files:**
- Create: `app/api/block/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_id } = await request.json() as { target_id: string }
  if (!target_id || target_id === user.id) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  // Block is idempotent (unique constraint). On block, also tear down any match
  // so neither can message the other.
  const { error } = await (supabase as any)
    .from('blocks').insert({ blocker_id: user.id, blocked_id: target_id })
  // Remove any match between the two (either ordering)
  const [u1, u2] = [user.id, target_id].sort()
  await (supabase as any).from('matches').delete().eq('user1_id', u1).eq('user2_id', u2)

  if (error && !error.message?.includes('duplicate')) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ blocked: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_id } = await request.json() as { target_id: string }
  if (!target_id) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  await (supabase as any).from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', target_id)
  return NextResponse.json({ blocked: false })
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit` then `npm run build`
Expected: compiles; route `ƒ /api/block` listed.

- [ ] **Step 3: Smoke-test auth gate**

Run: `curl.exe -s -o NUL -w "%{http_code}" -X POST "$APP/api/block" --data "{}"` (`$APP` = `https://techdate-eta.vercel.app`)
Expected: `401`

- [ ] **Step 4: Commit**

```bash
git add app/api/block/route.ts
git commit -m "feat: block/unblock API; blocking tears down any existing match"
```

---

## Task 3: Apply blocking to Discover, Feed, Requests, Notifications

**Files:**
- Modify: `app/(app)/discover/page.tsx` (the `excludeIds` set)
- Modify: `app/(app)/feed/page.tsx` (filter posts by blocked authors)
- Modify: `lib/notifications.ts` (exclude blocked authors)
- Modify: `supabase/migrations/015...` is already done; reuse `get_blocked_ids()`

- [ ] **Step 1: Discover — add blocked ids to exclusion**

In `app/(app)/discover/page.tsx`, the `Promise.all` that builds `incoming/mySwipes/myMatches` — add a 4th call and fold blocked ids into `excludeIds`:

```typescript
const [{ data: incoming }, { data: mySwipes }, { data: myMatches }, { data: blocked }] = await Promise.all([
  (supabase as any).rpc('get_incoming_requests'),
  (supabase as any).from('swipes').select('swiped_id').eq('swiper_id', user.id),
  (supabase as any).from('matches').select('user1_id, user2_id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
  (supabase as any).rpc('get_blocked_ids'),
])
const blockedIds: string[] = (blocked ?? []).map((b: any) => b.user_id)
// ...existing requesterIds/swipedIds/matchedIds...
const excludeIds = Array.from(new Set([...requesterIds, ...swipedIds, ...matchedIds, ...blockedIds]))
```

- [ ] **Step 2: Feed — hide posts by blocked users**

In `app/(app)/feed/page.tsx`, after computing the query but before `.limit(30)`, fetch blocked ids once and exclude their authored posts:

```typescript
const { data: blocked } = await (supabase as any).rpc('get_blocked_ids')
const blockedIds: string[] = (blocked ?? []).map((b: any) => b.user_id)
if (blockedIds.length > 0) {
  query = query.not('author_id', 'in', `(${blockedIds.map((id: string) => `"${id}"`).join(',')})`)
}
```
Place this right after the `query = (supabase as any).from('posts')...select(...)` chain begins and before ordering. (Gideon posts have `author_id = null`, which `not in (...)` keeps — verified: `null` is never "in" a non-null list, so they survive.)

- [ ] **Step 3: Notifications — exclude blocked authors**

In `lib/notifications.ts`, after fetching `otherIds`, intersect-out blocked ids:

```typescript
const { data: blocked } = await supabase.rpc('get_blocked_ids')
const blockedIds = new Set((blocked ?? []).map((b: any) => b.user_id))
const visibleIds = otherIds.filter((id: string) => !blockedIds.has(id))
if (visibleIds.length === 0) return { items: [], unread: 0 }
```
Then use `visibleIds` in the `.in('author_id', visibleIds)` query.

- [ ] **Step 4: Verify build + deploy**

Run: `npx tsc --noEmit && npm run build`; then `npx vercel deploy --prod`.
Expected: clean build; `/feed`, `/discover` still 307 unauth.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/discover/page.tsx" "app/(app)/feed/page.tsx" lib/notifications.ts
git commit -m "feat: hide blocked users from discover, feed, and notifications"
```

---

## Task 4: Report API

**Files:**
- Create: `app/api/report/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_TYPES = ['user', 'post', 'comment']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_type, target_id, reason, details } = await request.json() as
    { target_type: string; target_id: string; reason: string; details?: string }

  if (!VALID_TYPES.includes(target_type) || !target_id || !reason) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const { error } = await (supabase as any).from('reports').insert({
    reporter_id: user.id, target_type, target_id, reason, details: details ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reported: true })
}
```

- [ ] **Step 2: Verify build**

Run: `npx tsc --noEmit && npm run build`
Expected: route `ƒ /api/report` listed.

- [ ] **Step 3: Smoke-test auth gate**

Run: `curl.exe -s -o NUL -w "%{http_code}" -X POST "$APP/api/report" --data "{}"`
Expected: `401`

- [ ] **Step 4: Commit**

```bash
git add app/api/report/route.ts
git commit -m "feat: report API for users, posts, and comments"
```

---

## Task 5: Unmatch API

**Files:**
- Create: `app/api/matches/[id]/route.ts`

- [ ] **Step 1: Write the route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: matchId } = await params

  // Only a party to the match may delete it. RLS SELECT already restricts reads
  // to parties; confirm membership, then delete.
  const { data: match } = await (supabase as any)
    .from('matches').select('user1_id, user2_id').eq('id', matchId).maybeSingle()
  if (!match || (match.user1_id !== user.id && match.user2_id !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await (supabase as any).from('matches').delete().eq('id', matchId)
  return NextResponse.json({ unmatched: true })
}
```

- [ ] **Step 2: Add a matches DELETE policy (extend migration 016 — see Task 8 file)**

Note for Task 8's migration: matches currently has SELECT + INSERT policies only. Add:
```sql
create policy "Users can delete own matches"
  on public.matches for delete
  using (auth.uid() = user1_id or auth.uid() = user2_id);
```
(This line is included in `016_content_ownership.sql` in Task 8.)

- [ ] **Step 3: Verify build + auth gate**

Run: `npx tsc --noEmit && npm run build`; `curl.exe -s -o NUL -w "%{http_code}" -X DELETE "$APP/api/matches/abc"` → `401`.

- [ ] **Step 4: Commit**

```bash
git add app/api/matches/\[id\]/route.ts
git commit -m "feat: unmatch API (delete a match you're part of)"
```

---

## Task 6: Reusable ActionMenu + wire block/report/unmatch into UI

**Files:**
- Create: `components/ui/ActionMenu.tsx`
- Modify: `app/(app)/messages/[matchId]/page.tsx` (pass other user id + matchId to a chat header menu)
- Create: `components/messages/ChatHeaderMenu.tsx` (block / report / unmatch)
- Modify: `components/feed/PostCard.tsx` and `app/(app)/posts/[id]/page.tsx` (report post; block author if not Gideon)

- [ ] **Step 1: Build the generic overflow menu**

```typescript
'use client'
import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal } from 'lucide-react'

export interface MenuItem { label: string; onClick: () => void; danger?: boolean }

export function ActionMenu({ items, label = 'More actions' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button aria-label={label} onClick={() => setOpen(o => !o)} className="text-ink-faint hover:text-ink p-1">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-40 w-44 card p-1 shadow-lg">
          {items.map((it, i) => (
            <button key={i} onClick={() => { setOpen(false); it.onClick() }}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-sunk ${it.danger ? 'text-clay-deep' : 'text-ink'}`}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Chat header menu (block / report / unmatch)**

Create `components/messages/ChatHeaderMenu.tsx`:
```typescript
'use client'
import { useRouter } from 'next/navigation'
import { ActionMenu } from '@/components/ui/ActionMenu'

export function ChatHeaderMenu({ matchId, otherUserId }: { matchId: string; otherUserId: string }) {
  const router = useRouter()
  async function unmatch() {
    if (!confirm('Unmatch and delete this conversation?')) return
    await fetch(`/api/matches/${matchId}`, { method: 'DELETE' })
    router.push('/matches')
  }
  async function block() {
    if (!confirm('Block this person? They will be removed from your matches and feed.')) return
    await fetch('/api/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_id: otherUserId }) })
    router.push('/matches')
  }
  async function report() {
    const reason = prompt('Why are you reporting this person? (harassment, spam, fake, other)')
    if (!reason) return
    await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_type: 'user', target_id: otherUserId, reason }) })
    alert('Reported. Thank you — our team will review.')
  }
  return <ActionMenu items={[
    { label: 'Report', onClick: report },
    { label: 'Block', onClick: block, danger: true },
    { label: 'Unmatch', onClick: unmatch, danger: true },
  ]} />
}
```

- [ ] **Step 3: Wire into the chat header**

In `app/(app)/messages/[matchId]/page.tsx`, the `other` object already resolves the other party; add `id` to its select (`user1:users!matches_user1_id_fkey(name, photo_url, id)` and same for user2), then in the header row add `<ChatHeaderMenu matchId={matchId} otherUserId={other.id} />` aligned right (wrap the existing header in `flex items-center justify-between`).

- [ ] **Step 4: Report/block on posts**

In `components/feed/PostCard.tsx` action row (and `app/(app)/posts/[id]/page.tsx`), add an `ActionMenu` for non-owner, non-Gideon posts with items: Report post (`target_type:'post'`), Block author (`target_id: post.users.id`). For the owner's own post, Task 9 adds Edit/Delete instead. Gate by comparing `post.users?.id === currentUserId`.

- [ ] **Step 5: Verify build + deploy + commit**

Run: `npx tsc --noEmit && npm run build && npx vercel deploy --prod`
```bash
git add components/ui/ActionMenu.tsx components/messages/ChatHeaderMenu.tsx "app/(app)/messages/[matchId]/page.tsx" components/feed/PostCard.tsx "app/(app)/posts/[id]/page.tsx"
git commit -m "feat: block/report/unmatch UI via overflow menus in chat and on posts"
```

---

## Task 7: Forgot / reset password

**Files:**
- Modify: `app/(auth)/login/page.tsx` (add "Forgot password?" link → calls `resetPasswordForEmail`)
- Create: `app/(auth)/reset-password/page.tsx` (recovery landing → `updateUser({ password })`)
- Modify: `app/auth/callback/route.ts` (route `type=recovery` to `/reset-password`)

- [ ] **Step 1: Add forgot-password to the login screen**

In `app/(auth)/login/page.tsx`, add a small handler and link under the password field (signin mode only):
```typescript
async function handleForgot() {
  if (!email) { setError('Enter your email first'); return }
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${location.origin}/auth/callback?type=recovery`,
  })
  setError(error ? error.message : '')
  if (!error) setMode('check_email')
}
```
Render (signin only): `<button onClick={handleForgot} className="text-clay-deep text-xs hover:underline">Forgot password?</button>`

- [ ] **Step 2: Handle the recovery redirect in the callback**

In `app/auth/callback/route.ts`, after `exchangeCodeForSession` succeeds, before the email_change / profile logic, add:
```typescript
if (type === 'recovery') {
  return NextResponse.redirect(`${origin}/reset-password`)
}
```

- [ ] **Step 3: Build the reset-password page**

Create `app/(auth)/reset-password/page.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (password.length < 6) { setError('At least 6 characters'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/feed'), 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="card max-w-sm w-full p-8 space-y-4 animate-rise">
        <h1 className="font-display text-2xl text-ink">Set a new password</h1>
        {done ? (
          <p className="text-sage text-sm">Password updated. Taking you in…</p>
        ) : (
          <>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="New password" className="input" />
            {error && <p className="text-clay-deep text-sm">{error}</p>}
            <button onClick={submit} disabled={loading} className="btn btn-primary w-full">
              {loading ? '…' : 'Update password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 4: Supabase dashboard config (manual, one-time)**

Add `https://techdate-eta.vercel.app/auth/callback` to Auth → URL Configuration → Redirect URLs (already required for signup; confirm it's present). No code.

- [ ] **Step 5: Verify build + deploy + commit**

Run: `npx tsc --noEmit && npm run build && npx vercel deploy --prod`; `/reset-password` returns 200 (it's an auth-group page, no guard).
```bash
git add "app/(auth)/login/page.tsx" "app/(auth)/reset-password/page.tsx" app/auth/callback/route.ts
git commit -m "feat: forgot-password + reset-password flow"
```

---

## Task 8: Content ownership policies + account deletion (migration 016)

**Files:**
- Create: `supabase/migrations/016_content_ownership.sql`

- [ ] **Step 1: Write the migration**

```sql
-- Let authors edit/delete their own posts
create policy "Authors can update own posts"
  on public.posts for update using (auth.uid() = author_id) with check (auth.uid() = author_id);
create policy "Authors can delete own posts"
  on public.posts for delete using (auth.uid() = author_id);

-- Let authors delete their own comments
create policy "Authors can delete own comments"
  on public.comments for delete using (auth.uid() = author_id);

-- Let users delete a match they belong to (used by unmatch + block)
create policy "Users can delete own matches"
  on public.matches for delete using (auth.uid() = user1_id or auth.uid() = user2_id);

-- Self-service account deletion. Deletes the auth user; public.users cascades
-- via its FK (on delete cascade), which cascades to posts/comments/likes/etc.
-- SECURITY DEFINER so it can touch auth.users; only ever deletes the caller.
create or replace function public.delete_own_account()
returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  delete from auth.users where id = auth.uid();
end;
$$;

revoke all on function public.delete_own_account() from public;
grant execute on function public.delete_own_account() to authenticated;
```

- [ ] **Step 2: Apply + verify the function is restricted to authenticated**

Run: `npx supabase db push`
Then anon RPC must be denied: `curl.exe -s -X POST "$REST/rpc/delete_own_account" -H "apikey: $ANON" -H "Authorization: Bearer $ANON" -H "Content-Type: application/json" --data "{}"`
Expected: a permission error (NOT a deletion) — anon lacks execute. (Confirms it can't be abused unauthenticated.)

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/016_content_ownership.sql
git commit -m "feat: RLS for editing/deleting own posts+comments, deleting own matches, and delete_own_account()"
```

---

## Task 9: Edit / delete own posts

**Files:**
- Create: `app/api/posts/[id]/route.ts` (PATCH + DELETE)
- Create: `components/feed/PostOwnerMenu.tsx`
- Modify: `app/(app)/posts/[id]/page.tsx` (show owner menu)

- [ ] **Step 1: Post PATCH/DELETE route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { title, content } = await request.json() as { title?: string; content?: string }
  const patch: Record<string, unknown> = {}
  if (typeof title === 'string' && title.trim()) patch.title = title.trim()
  if (typeof content === 'string') patch.content = content
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'Nothing to update' }, { status: 400 })
  // RLS ensures only the author's row updates
  const { error } = await (supabase as any).from('posts').update(patch).eq('id', id).eq('author_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { error } = await (supabase as any).from('posts').delete().eq('id', id).eq('author_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```
Note: `/api/posts/[id]/like`, `/comments`, `/bookmark` are child routes and are unaffected by adding `route.ts` at `[id]`.

- [ ] **Step 2: Owner menu component**

Create `components/feed/PostOwnerMenu.tsx`:
```typescript
'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionMenu } from '@/components/ui/ActionMenu'

export function PostOwnerMenu({ postId, title, content }: { postId: string; title: string; content: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [t, setT] = useState(title)
  const [c, setC] = useState(content ?? '')

  async function save() {
    await fetch(`/api/posts/${postId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t, content: c }) })
    setEditing(false); router.refresh()
  }
  async function del() {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    router.push('/feed')
  }

  return (
    <>
      <ActionMenu items={[
        { label: 'Edit', onClick: () => setEditing(true) },
        { label: 'Delete', onClick: del, danger: true },
      ]} />
      {editing && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="card w-full max-w-md p-5 space-y-3 animate-pop">
            <h2 className="font-display text-2xl text-ink">Edit post</h2>
            <input value={t} onChange={e => setT(e.target.value)} className="input" />
            <textarea value={c} onChange={e => setC(e.target.value)} className="input h-28 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={save} disabled={!t.trim()} className="btn btn-primary text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 3: Show it on the detail page when the viewer is the author**

In `app/(app)/posts/[id]/page.tsx`, the page already has `user` and `post`. In the author row, when `post.users?.id === user.id && !post.is_gideon`, render `<PostOwnerMenu postId={id} title={post.title} content={post.content} />` aligned right (wrap author row in `flex items-center justify-between`).

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm run build && npx vercel deploy --prod`; `curl.exe -s -o NUL -w "%{http_code}" -X DELETE "$APP/api/posts/abc"` → `401`.
```bash
git add app/api/posts/\[id\]/route.ts components/feed/PostOwnerMenu.tsx "app/(app)/posts/[id]/page.tsx"
git commit -m "feat: edit/delete your own posts"
```

---

## Task 10: Threaded comment replies + delete

**Files:**
- Create: `app/api/posts/[id]/comments/[commentId]/route.ts` (DELETE)
- Modify: `app/api/posts/[id]/comments/route.ts` (GET returns all comments, not just top-level)
- Modify: `components/feed/CommentSection.tsx` (render tree, reply box, delete)

- [ ] **Step 1: GET all comments (so replies are fetchable)**

In `app/api/posts/[id]/comments/route.ts` GET, remove the `.is('parent_id', null)` filter so every comment is returned (the client builds the tree). Add `author_id` and `parent_id` to the select:
```typescript
.select('id, content, created_at, parent_id, author_id, users(id, name, photo_url)')
.eq('post_id', id)
.order('created_at', { ascending: true })
```

- [ ] **Step 2: Comment DELETE route**

Create `app/api/posts/[id]/comments/[commentId]/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string; commentId: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { commentId } = await params
  const { error } = await (supabase as any).from('comments').delete().eq('id', commentId).eq('author_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 3: Rewrite CommentSection to support replies + delete**

Replace `components/feed/CommentSection.tsx` with a version that:
- Accepts `currentUserId: string` prop (pass it from the detail page: `<CommentSection postId={id} currentUserId={user.id} />`).
- `Comment` type adds `parent_id: string | null`, `author_id: string`, `users: { id: string; name: string; photo_url: string | null }`.
- Groups comments: top-level = `parent_id === null`; replies = grouped by `parent_id`.
- Renders each top-level comment, its replies indented (`ml-6 border-l border-line pl-3`), a "Reply" button that reveals an inline reply input, and a "Delete" link when `author_id === currentUserId`.
- Posting a reply: `POST /api/posts/${postId}/comments` with `{ content, parent_id: <commentId> }` (route already accepts `parent_id` and awards `reply` XP).
- Posting top-level: unchanged (`{ content }`).
- Delete: `DELETE /api/posts/${postId}/comments/${commentId}` then remove from local state.

Key handlers:
```typescript
async function submit(parentId: string | null, value: string) {
  const res = await fetch(`/api/posts/${postId}/comments`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content: value, parent_id: parentId }),
  })
  const data = await res.json()
  if (data.comment) setComments(prev => [...prev, data.comment])
}
async function remove(commentId: string) {
  await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' })
  setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId))
}
```
(When deleting a top-level comment, also drop its replies locally, as shown.)

- [ ] **Step 4: Pass currentUserId from the detail page**

In `app/(app)/posts/[id]/page.tsx`, change `<CommentSection postId={id} />` to `<CommentSection postId={id} currentUserId={user.id} />`.

- [ ] **Step 5: Verify + commit**

Run: `npx tsc --noEmit && npm run build && npx vercel deploy --prod`.
Verify GET shape: `curl.exe -s "$REST/comments?select=id,parent_id&limit=2" -H "apikey: $ANON" -H "Authorization: Bearer $ANON"` returns rows incl `parent_id`.
```bash
git add app/api/posts/\[id\]/comments/route.ts app/api/posts/\[id\]/comments/\[commentId\]/route.ts components/feed/CommentSection.tsx "app/(app)/posts/[id]/page.tsx"
git commit -m "feat: threaded comment replies (earns reply XP) + delete own comment"
```

---

## Task 11: Public user profiles

**Files:**
- Create: `app/(app)/users/[id]/page.tsx`
- Modify: `components/feed/PostCard.tsx` (link author name/avatar → `/users/[id]`)
- Modify: `app/(app)/posts/[id]/page.tsx` (link author → profile)

- [ ] **Step 1: Public profile page**

Create `app/(app)/users/[id]/page.tsx` (server component):
- `await params` → `id`; get viewer via `getUser` (redirect `/login` if none).
- If `id === user.id` → `redirect('/profile')` (own profile has edit).
- Fetch target: `from('users').select('name, photo_url, city, genres, xp, bio, last_active').eq('id', id).maybeSingle()`; if null → `redirect('/feed')`.
- Check block state: `rpc('get_blocked_ids')`; if `id` ∈ blocked → show a minimal "This user is unavailable" card.
- Render: `BackButton`, avatar + name + city, `XpBadge`, "active recently" (Task 13 helper), bio, genre chips, and their recent community posts (`from('posts').select('*, users(id,name,photo_url)').eq('author_id', id).eq('is_gideon', false).order('created_at', {ascending:false}).limit(10)`) rendered with `PostCard` (fetch viewer's like/bookmark state for those, same pattern as `/saved`).
- Include an `ActionMenu` (Report user / Block) at top-right.

- [ ] **Step 2: Link authors to their profile**

In `components/feed/PostCard.tsx`, when `!post.is_gideon`, wrap the author avatar+name in `<Link href={\`/users/${post.users?.id}\`}>` (stop the card-body Link from swallowing it — render the author row OUTSIDE the post-body `Link`, as its own row above it). Do the same on the detail page author row.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npm run build && npx vercel deploy --prod`; `curl.exe -s -o NUL -w "%{http_code}" "$APP/users/abc"` → `307` (unauth).
```bash
git add "app/(app)/users/[id]/page.tsx" components/feed/PostCard.tsx "app/(app)/posts/[id]/page.tsx"
git commit -m "feat: public user profile pages; author names/avatars link to them"
```

---

## Task 12: Account deletion UI

**Files:**
- Create: `app/api/account/route.ts` (DELETE → calls `delete_own_account` RPC, then signs out)
- Modify: `app/(app)/profile/page.tsx` (Danger zone → Delete account)
- Create: `components/profile/DeleteAccount.tsx`

- [ ] **Step 1: Account DELETE route**

```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await (supabase as any).rpc('delete_own_account')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
```

- [ ] **Step 2: Delete-account UI**

Create `components/profile/DeleteAccount.tsx`:
```typescript
'use client'
import { useRouter } from 'next/navigation'
export function DeleteAccount() {
  const router = useRouter()
  async function del() {
    if (!confirm('Delete your account permanently? This cannot be undone.')) return
    if (!confirm('Really delete everything — profile, posts, matches, messages?')) return
    await fetch('/api/account', { method: 'DELETE' })
    router.push('/login')
  }
  return (
    <button onClick={del} className="btn btn-ghost w-full text-sm text-clay-deep border-clay/30">
      Delete account
    </button>
  )
}
```
Add `<DeleteAccount />` below the Sign out button in `app/(app)/profile/page.tsx`.

- [ ] **Step 3: Verify + commit**

Run: `npx tsc --noEmit && npm run build && npx vercel deploy --prod`; `curl.exe -s -o NUL -w "%{http_code}" -X DELETE "$APP/api/account"` → `401`.
```bash
git add app/api/account/route.ts components/profile/DeleteAccount.tsx "app/(app)/profile/page.tsx"
git commit -m "feat: self-service account deletion (DPDP/privacy)"
```

---

## Task 13: Multiple profile photos (migration 017)

**Files:**
- Create: `supabase/migrations/017_profile_photos.sql`
- Modify: `components/profile/EditProfile.tsx` (upload up to 5 photos)
- Modify: `components/dating/ProfileCard.tsx` (photo carousel)
- Modify: `lib/supabase/types.ts` (add `photos` to users Row — optional, `as any` covers runtime)

- [ ] **Step 1: Migration**

```sql
alter table public.users add column if not exists photos text[] not null default '{}';
-- Backfill: seed the array with the existing single photo where present
update public.users set photos = array[photo_url] where photo_url is not null and photos = '{}';
```
Run: `npx supabase db push`. Keep `photo_url` as the "primary/avatar" (header, lists); `photos[0]` should mirror it.

- [ ] **Step 2: EditProfile — manage a small gallery**

In `components/profile/EditProfile.tsx`, extend state with `photos: string[]` (init from `initial.photos ?? (initial.photo_url ? [initial.photo_url] : [])`). Allow uploading up to 5 (reuse the existing `avatars` bucket + uploader; push public URLs into `photos`). Render thumbnails with a remove (✕) each. On save, write `{ photos, photo_url: photos[0] ?? null }` so the avatar stays in sync. Pass `photos` from `app/(app)/profile/page.tsx`'s select.

- [ ] **Step 3: ProfileCard — carousel**

In `components/dating/ProfileCard.tsx`, accept `profile.photos` (fallback to `[photo_url]`). If >1, render a simple swipeable strip: a horizontal `overflow-x-auto snap-x` row of images, or prev/next chevrons cycling an index with `useState`. Show dots indicating position. Single/zero photos behave as today (letter avatar).
Add `photos: string[] | null` to `types/dating.ts::DatingProfile` and include `photos` in the discover candidate select (`app/(app)/discover/page.tsx`).

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm run build && npx vercel deploy --prod`.
```bash
git add supabase/migrations/017_profile_photos.sql components/profile/EditProfile.tsx components/dating/ProfileCard.tsx types/dating.ts "app/(app)/discover/page.tsx" "app/(app)/profile/page.tsx" lib/supabase/types.ts
git commit -m "feat: multiple profile photos with carousel on dating cards"
```

---

## Task 14: "Active recently" status

**Files:**
- Modify: `components/layout/StreakPing.tsx` → also bump `last_active` (or create `app/api/active/route.ts`)
- Create: `lib/active.ts` (`activeLabel(iso)` helper)
- Modify: `components/dating/ProfileCard.tsx`, `app/(app)/users/[id]/page.tsx` (show status)

- [ ] **Step 1: Touch last_active on app load**

Add `app/api/active/route.ts`:
```typescript
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await (supabase as any).from('users').update({ last_active: new Date().toISOString() }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}
```
In `components/layout/StreakPing.tsx`'s effect, also `fetch('/api/active', { method: 'POST' })` (fire-and-forget) so every session bumps `last_active`.

- [ ] **Step 2: Status helper**

Create `lib/active.ts`:
```typescript
export function activeLabel(iso: string | null): string | null {
  if (!iso) return null
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 15) return 'Active now'
  if (mins < 60) return 'Active recently'
  if (mins < 1440) return `Active ${Math.floor(mins / 60)}h ago`
  const d = Math.floor(mins / 1440)
  return d <= 7 ? `Active ${d}d ago` : null
}
```

- [ ] **Step 3: Show it**

In `ProfileCard.tsx` and `users/[id]/page.tsx`, render `activeLabel(profile.last_active)` (skip if null) as a small sage/ink-faint line with a dot: green dot for "Active now". `last_active` is already in the discover candidate select; add it to the `users/[id]` select.

- [ ] **Step 4: Verify + commit**

Run: `npx tsc --noEmit && npm run build && npx vercel deploy --prod`; `curl.exe -s -o NUL -w "%{http_code}" -X POST "$APP/api/active"` → `401`.
```bash
git add app/api/active/route.ts lib/active.ts components/layout/StreakPing.tsx components/dating/ProfileCard.tsx "app/(app)/users/[id]/page.tsx"
git commit -m "feat: update + show 'active recently' status"
```

---

## Suggested execution order & dependencies

1. **Task 1** (blocks/reports schema) → unblocks Tasks 2, 3, 4, 6, 11.
2. **Task 2** (block API) → **Task 3** (apply blocking) → **Task 4** (report API) → **Task 5** (unmatch API).
3. **Task 8** (ownership migration) must land before **Task 9** (edit/delete posts), **Task 10** (delete comments), **Task 12** (account deletion), and Task 5's matches-delete policy.
4. **Task 6** (ActionMenu + UI) depends on Tasks 2/4/5 existing.
5. **Task 7** (password reset) is independent — can be done anytime.
6. **Tasks 9, 10, 11** (edit/delete, replies, public profiles) depend on Task 8 and Task 1 (block filter in profiles).
7. **Task 12** (account deletion UI) depends on Task 8.
8. **Tasks 13, 14** (photos, active status) are independent polish — last.

**Tier mapping:** Tier 1 = Tasks 1–8, 12 (safety + reset + deletion). Tier 2 = Tasks 9–11 (ownership, replies, profiles). Tier 3 = Tasks 13–14 (photos, active).

---

## Self-Review

**Spec coverage (features 1–8):**
1. Block/Report/Unmatch → Tasks 1,2,3,4,5,6 ✓
2. Password reset → Task 7 ✓
3. Account deletion → Tasks 8 (fn) + 12 (UI) ✓
4. Comment replies → Task 10 ✓
5. Public user profiles → Task 11 ✓
6. Edit/delete own posts & comments → Tasks 9 (posts) + 10 (comments) ✓
7. Multiple profile photos → Task 13 ✓
8. Active recently → Task 14 ✓

**Type/contract consistency checks:**
- `get_blocked_ids()` returns rows `{ user_id }` — consumers map `b.user_id` (Tasks 3, 11, 14-area). ✓
- Block API field is `target_id`; report API uses `target_type`/`target_id`/`reason`; both consumed consistently in Task 6. ✓
- `CommentSection` gains `currentUserId` prop — set in Task 10 Step 4 detail page. ✓
- `delete_own_account()` relies on `auth.users → public.users` FK being `on delete cascade` (confirmed in `001_users.sql`: `references auth.users(id) on delete cascade`), and `public.users → posts/comments/...` cascades (confirmed in `002`/`004`/`005`). ✓
- Migration numbers 015–017 do not collide with existing 001–014. ✓

**Known risks flagged:**
- Account deletion uses a `SECURITY DEFINER` SQL fn (not the service-role key) specifically because the Vercel `SUPABASE_SERVICE_ROLE_KEY` was set via a shell that corrupted other vars; avoiding it removes that dependency. If `delete from auth.users` is blocked by Supabase's permissions for the function owner, fall back to a service-role API route — but verify the key is clean first (`vercel env` re-set via the cmd-redirect method used for the anon key).
- `not('author_id','in', '(...)')` excludes blocked authors but Gideon posts (`author_id = null`) correctly survive — confirmed by SQL `NOT IN` null semantics.
