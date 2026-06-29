# In-App Notification Center Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Surface every push-worthy event (Ping, Ping accepted, message, Gideon post, Peer post) in the in-app notification bell, backed by a stored `notifications` table that is the single source of truth shared with push.

**Architecture:** New `notifications` table + a `notify()` helper that inserts a row (awaited, via service-role admin client) and fires push (deferred). Event API routes call `notify()` instead of `sendPush()`. The bell reads the table; unread reuses `users.last_notifications_seen`. The obsolete `dismissed_notifications` table is dropped; dismissal now sets `notifications.dismissed_at`.

**Tech Stack:** Next.js 16 (App Router), Supabase Postgres + RLS, `@supabase/supabase-js` (admin client), FCM HTTP v1, Vitest + jsdom.

## Global Constraints

- Every server-side Supabase query uses `(supabase as any).from(...)` — the `Database` generic does not propagate. Keep the casts.
- Next.js 16: dynamic route `params` is `Promise<{...}>` — `await params`. (Not hit in this plan, but applies.)
- `sendPush` / `notify` are **fire-and-forget safe**: API routes must never await-block on push and must still return success if push throws.
- Push copy reads "Await" (brand name).
- Notification deep-link routes match push routes exactly: Ping=`/discover`, accept/message=`/messages/{matchId}`, Gideon/Peer post=`/posts/{id|slug}`.
- Notifications are written for OTHER users → inserts MUST use `createAdminClient()` (service-role, bypasses RLS). Reads/updates/deletes of own rows use the cookie client (RLS `user_id = auth.uid()`).
- `notifications` PK is a single `id` column — never a two-FK composite PK (that recreated the PostgREST junction bug in migration 023).
- Tests: Vitest, files under `tests/lib/`. Full suite must stay green; `tsc` clean.

---

### Task 1: Migration `028_notifications.sql` (create table, RLS, drop old table) + apply to DB

**Files:**
- Create: `supabase/migrations/028_notifications.sql`
- Create: `scripts/db-exec.mjs` (reusable migration runner — no psql on this box)

**Interfaces:**
- Produces: `notifications` table with columns `id, user_id, type, title, body, route, actor_id, post_id, dismissed_at, created_at`; FK constraints named `notifications_user_id_fkey` and `notifications_actor_id_fkey` (used for the PostgREST embed hint in Task 3). Drops `dismissed_notifications`.

- [ ] **Step 1: Write the migration SQL**

Create `supabase/migrations/028_notifications.sql`:

```sql
-- Stored, event-sourced notification center.
-- Replaces the post-derivation model: every push-worthy event inserts a row here
-- so the in-app bell and phone push share one source of truth.

create table if not exists notifications (
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

create index if not exists notifications_user_created_idx
  on notifications (user_id, created_at desc);

alter table notifications enable row level security;

-- Recipient owns their rows. NO insert policy: rows are written for other users
-- via the service-role admin client (RLS bypassed).
create policy notifications_select_own on notifications
  for select using (user_id = auth.uid());
create policy notifications_update_own on notifications
  for update using (user_id = auth.uid());
create policy notifications_delete_own on notifications
  for delete using (user_id = auth.uid());

-- Obsolete: notifications are no longer derived from posts, so the post-keyed
-- dismissal table is gone. Dismissal now sets notifications.dismissed_at.
drop table if exists dismissed_notifications;
```

- [ ] **Step 2: Write the migration runner script**

Create `scripts/db-exec.mjs`:

```js
// One-off SQL runner (no psql available locally).
// Usage: SUPABASE_DB_URL="postgresql://...:<encoded-pw>@aws-1-ap-south-1.pooler.supabase.com:5432/postgres" \
//   node scripts/db-exec.mjs supabase/migrations/028_notifications.sql
import { readFileSync } from 'node:fs'
import pg from 'pg'

const file = process.argv[2]
if (!file) { console.error('usage: node scripts/db-exec.mjs <file.sql>'); process.exit(1) }
const url = process.env.SUPABASE_DB_URL
if (!url) { console.error('set SUPABASE_DB_URL'); process.exit(1) }

const sql = readFileSync(file, 'utf8')
const c = new pg.Client({ connectionString: url })
await c.connect()
await c.query(sql)
console.log('applied:', file)
await c.end()
```

- [ ] **Step 3: Ensure the `pg` client is available**

Run: `node -e "require.resolve('pg')" || npm install pg --no-save`
Expected: no error (pg resolvable).

- [ ] **Step 4: Apply the migration to the database**

> Connection uses the `aws-1-ap-south-1` **session pooler** (IPv4 path; Supabase direct host is IPv6-only). Password must be URL-encoded (`@`→`%40`). Do NOT hardcode the password in any committed file.

PowerShell:
```powershell
$env:SUPABASE_DB_URL = "postgresql://postgres.ynfkwndtmoajcmjppftp:%40techdate818%40@aws-1-ap-south-1.pooler.supabase.com:5432/postgres"
node scripts/db-exec.mjs supabase/migrations/028_notifications.sql
```
Expected: `applied: supabase/migrations/028_notifications.sql`

- [ ] **Step 5: Verify the schema landed**

Run (inline node, same `$env:SUPABASE_DB_URL`):
```powershell
node -e "import('pg').then(async({default:pg})=>{const c=new pg.Client({connectionString:process.env.SUPABASE_DB_URL});await c.connect();const t=await c.query(`select table_name from information_schema.tables where table_schema='public' and table_name in ('notifications','dismissed_notifications')`);console.log(t.rows.map(r=>r.table_name));await c.end()})"
```
Expected: `[ 'notifications' ]` (notifications present, dismissed_notifications gone).

- [ ] **Step 6: Commit**

```bash
git add supabase/migrations/028_notifications.sql scripts/db-exec.mjs
git commit -m "feat(db): add notifications table, drop dismissed_notifications (028)"
```

---

### Task 2: `notify()` helper

**Files:**
- Create: `lib/notifications/notify.ts`
- Test: `tests/lib/notifications/notify.test.ts`

**Interfaces:**
- Consumes: `createAdminClient()` from `lib/supabase/admin.ts`; `sendPush(userId, {title, body, route?})` from `lib/push/send.ts`.
- Produces:
  ```ts
  export type NotificationType = 'ping' | 'ping_accepted' | 'message' | 'peer_post' | 'gideon_post'
  export interface NotifyOpts {
    type: NotificationType
    title: string
    body?: string
    route?: string
    actorId?: string
    postId?: string
    push?: boolean   // default true
  }
  export function notify(userId: string, opts: NotifyOpts): Promise<void>
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/lib/notifications/notify.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { sendPush, insertMock, fromMock, adminClient } = vi.hoisted(() => {
  const sendPush = vi.fn().mockResolvedValue(undefined)
  const insertMock = vi.fn().mockResolvedValue({ error: null })
  const fromMock = vi.fn().mockReturnValue({ insert: insertMock })
  const adminClient = { from: fromMock }
  return { sendPush, insertMock, fromMock, adminClient }
})

vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => adminClient }))
vi.mock('@/lib/push/send', () => ({ sendPush }))

import { notify } from '@/lib/notifications/notify'

describe('notify()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    insertMock.mockResolvedValue({ error: null })
  })

  it('inserts a notification row with mapped fields', async () => {
    await notify('recipient-1', {
      type: 'ping', title: 'New Ping', body: 'X pinged you',
      route: '/discover', actorId: 'actor-9',
    })
    expect(fromMock).toHaveBeenCalledWith('notifications')
    expect(insertMock).toHaveBeenCalledWith({
      user_id: 'recipient-1',
      type: 'ping',
      title: 'New Ping',
      body: 'X pinged you',
      route: '/discover',
      actor_id: 'actor-9',
      post_id: null,
    })
  })

  it('fires push by default with title/body/route', async () => {
    await notify('recipient-1', { type: 'message', title: 'New message', body: 'hi', route: '/messages/m1' })
    expect(sendPush).toHaveBeenCalledWith('recipient-1', { title: 'New message', body: 'hi', route: '/messages/m1' })
  })

  it('skips push when push:false (bell-only)', async () => {
    await notify('recipient-1', { type: 'peer_post', title: 'New post', route: '/posts/abc', push: false })
    expect(insertMock).toHaveBeenCalled()
    expect(sendPush).not.toHaveBeenCalled()
  })

  it('never throws when the insert errors', async () => {
    insertMock.mockResolvedValue({ error: new Error('db down') })
    await expect(notify('r', { type: 'ping', title: 'x' })).resolves.toBeUndefined()
  })

  it('never throws when push throws', async () => {
    sendPush.mockImplementation(() => { throw new Error('boom') })
    await expect(notify('r', { type: 'ping', title: 'x' })).resolves.toBeUndefined()
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/notifications/notify.test.ts`
Expected: FAIL — cannot resolve `@/lib/notifications/notify`.

- [ ] **Step 3: Write minimal implementation**

Create `lib/notifications/notify.ts`:

```ts
import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/push/send'

export type NotificationType =
  | 'ping' | 'ping_accepted' | 'message' | 'peer_post' | 'gideon_post'

export interface NotifyOpts {
  type: NotificationType
  title: string
  body?: string
  route?: string
  actorId?: string
  postId?: string
  push?: boolean
}

/**
 * Single source of truth for a notable event: persist a bell row AND fire push.
 * The row insert is awaited (cheap, indexed) so the bell never misses an event;
 * push is fired deferred and best-effort. Never throws — callers fire-and-forget.
 * Inserts use the service-role admin client because rows target OTHER users.
 */
export async function notify(userId: string, opts: NotifyOpts): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await (admin as any).from('notifications').insert({
      user_id: userId,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      route: opts.route ?? null,
      actor_id: opts.actorId ?? null,
      post_id: opts.postId ?? null,
    })
    if (error) return // bell insert failed — still attempt push below? No: keep simple, return.
  } catch {
    return
  }

  if (opts.push === false) return
  void Promise.resolve()
    .then(() => sendPush(userId, { title: opts.title, body: opts.body ?? '', route: opts.route }))
    .catch(() => {})
}
```

> Note: the `body` typed by `sendPush` is `string`; pass `opts.body ?? ''`.

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/notifications/notify.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications/notify.ts tests/lib/notifications/notify.test.ts
git commit -m "feat(notifications): add notify() helper (row insert + push)"
```

---

### Task 3: Rewrite `getNotifications` to read the stored table

**Files:**
- Modify: `lib/notifications.ts` (full rewrite of `getNotifications`)
- Test: `tests/lib/notifications/get-notifications.test.ts`

**Interfaces:**
- Consumes: a Supabase cookie client (passed in) with RLS; `users.last_notifications_seen`.
- Produces:
  ```ts
  type NotificationItem = {
    id: string; type: string; title: string; body: string | null;
    route: string | null; actorName: string | null; actorPhoto: string | null;
    created_at: string; isNew: boolean
  }
  getNotifications(supabase, userId): Promise<{ items: NotificationItem[]; unread: number }>
  ```

- [ ] **Step 1: Write the failing test**

Create `tests/lib/notifications/get-notifications.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { getNotifications } from '@/lib/notifications'

function makeSupabase({ lastSeen, rows }: { lastSeen: string | null; rows: any[] }) {
  return {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        return {
          select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { last_notifications_seen: lastSeen } }) }) }),
        }
      }
      // notifications
      return {
        select: () => ({
          eq: () => ({
            is: () => ({
              order: () => ({
                limit: () => Promise.resolve({ data: rows, error: null }),
              }),
            }),
          }),
        }),
      }
    }),
  }
}

describe('getNotifications (stored table)', () => {
  it('maps rows and computes isNew via last_notifications_seen', async () => {
    const rows = [
      { id: 'n1', type: 'ping', title: 'New Ping', body: 'X pinged you', route: '/discover',
        created_at: '2026-06-29T10:00:00Z', actor: { name: 'X', photo_url: 'p.jpg' } },
      { id: 'n2', type: 'message', title: 'New message', body: 'hi', route: '/messages/m1',
        created_at: '2026-06-29T08:00:00Z', actor: { name: 'Y', photo_url: null } },
    ]
    const supabase = makeSupabase({ lastSeen: '2026-06-29T09:00:00Z', rows })
    const { items, unread } = await getNotifications(supabase, 'me')

    expect(items).toHaveLength(2)
    expect(items[0]).toMatchObject({ id: 'n1', type: 'ping', actorName: 'X', actorPhoto: 'p.jpg', isNew: true })
    expect(items[1]).toMatchObject({ id: 'n2', actorName: 'Y', actorPhoto: null, isNew: false })
    expect(unread).toBe(1)
  })

  it('returns empty when there are no notifications', async () => {
    const supabase = makeSupabase({ lastSeen: null, rows: [] })
    const { items, unread } = await getNotifications(supabase, 'me')
    expect(items).toEqual([])
    expect(unread).toBe(0)
  })

  it('treats a null actor (e.g. gideon) as no actorName/photo', async () => {
    const rows = [{ id: 'g1', type: 'gideon_post', title: 'tech: new post', body: 'A title', route: '/posts/abc',
      created_at: '2026-06-29T10:00:00Z', actor: null }]
    const supabase = makeSupabase({ lastSeen: null, rows })
    const { items } = await getNotifications(supabase, 'me')
    expect(items[0]).toMatchObject({ actorName: null, actorPhoto: null, isNew: true })
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/notifications/get-notifications.test.ts`
Expected: FAIL — old `getNotifications` queries `matches`/`posts`, returns wrong shape.

- [ ] **Step 3: Rewrite the implementation**

Replace the entire contents of `lib/notifications.ts` with:

```ts
// In-app notification center: reads the stored `notifications` table.
// Unread is derived from users.last_notifications_seen (badge clears when the
// notifications page is opened). Inserts happen via lib/notifications/notify.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getNotifications(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('users').select('last_notifications_seen').eq('id', userId).single()
  const lastSeen = profile?.last_notifications_seen
    ? new Date(profile.last_notifications_seen).getTime() : 0

  // actor is disambiguated by FK name because notifications has TWO FKs to users
  // (user_id + actor_id) — an un-hinted users(...) embed would be ambiguous.
  const { data: rows } = await supabase
    .from('notifications')
    .select('id, type, title, body, route, created_at, actor:users!notifications_actor_id_fkey(name, photo_url)')
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(30)

  const items = (rows ?? []).map((r: any) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body ?? null,
    route: r.route ?? null,
    actorName: r.actor?.name ?? null,
    actorPhoto: r.actor?.photo_url ?? null,
    created_at: r.created_at,
    isNew: new Date(r.created_at).getTime() > lastSeen,
  }))

  return { items, unread: items.filter((i: any) => i.isNew).length }
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/notifications/get-notifications.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/notifications.ts tests/lib/notifications/get-notifications.test.ts
git commit -m "feat(notifications): read stored notifications table in getNotifications"
```

---

### Task 4: Wire event routes to `notify()` (swipes, requests, messages, gideon-push)

**Files:**
- Modify: `app/api/swipes/route.ts:5,46`
- Modify: `app/api/requests/route.ts:3,69`
- Modify: `app/api/messages/route.ts:4,71`
- Modify: `app/api/internal/gideon-push/route.ts:3,46-56`
- Modify: `tests/lib/api/push-hooks.test.ts` (mock `notify` instead of `sendPush`)

**Interfaces:**
- Consumes: `notify(userId, opts)` from `lib/notifications/notify.ts` (Task 2).

- [ ] **Step 1: Update the push-hooks test to expect `notify()`**

In `tests/lib/api/push-hooks.test.ts`:

Replace the hoisted `sendPush` mock + `vi.mock('@/lib/push/send', ...)` (lines 7–26 region) so `notify` is mocked instead. Change the hoisted block's first line to also create `notify`:

```ts
const { notify, getUser, mockFrom } = vi.hoisted(() => {
  const notify = vi.fn().mockResolvedValue(undefined)
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'current-user' } } })
  const mockSingle = vi.fn()
  const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) })
  const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) })
  const mockEq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }), single: mockSingle })
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect, insert: mockInsert,
    delete: vi.fn().mockReturnValue({ eq: mockEq }), eq: mockEq,
  })
  return { notify, getUser, mockFrom, mockSingle, mockSelect, mockInsert, mockEq }
})

vi.mock('@/lib/notifications/notify', () => ({ notify }))
```

Then replace every `sendPush` reference in the file with `notify`, and update the expected payloads to the `notify` shape (add `type`, rename to opts object). Specifically:

- Swipes "right-swipe" test expectation:
```ts
expect(notify).toHaveBeenCalledWith('target-user', {
  type: 'ping', title: 'New Ping', body: 'Someone wants to connect on Await', route: '/discover',
  actorId: 'swiper-id',
})
```
- Swipes "left-swipe" / "throws" tests: replace `sendPush` → `notify` (and the `mockImplementation(() => { throw })`).
- Requests "accept" expectation:
```ts
expect(notify).toHaveBeenCalledWith('req-user', {
  type: 'ping_accepted', title: 'Ping accepted', body: 'Your Ping was accepted — say hi',
  route: '/messages/match-abc', actorId: 'acceptor-id',
})
```
- Requests "decline"/"null match"/"throws": `sendPush` → `notify`.
- Messages "sends push" expectation:
```ts
expect(notify).toHaveBeenCalledWith('user-B', {
  type: 'message', title: 'New message', body: 'hello',
  route: `/messages/${MATCH_ID}`, actorId: 'user-A',
})
```
- Messages "user1 when sender is user2": `expect(notify).toHaveBeenCalledWith('user-A', expect.objectContaining({ route: \`/messages/${MATCH_ID}\` }))`.
- Messages "trims to 80": `const call = notify.mock.calls[0]; expect(call[1].body.length).toBe(80)`.
- Messages "insert fails": `expect(notify).not.toHaveBeenCalled()`.
- All "throws synchronously" tests: `notify.mockImplementation(() => { throw new Error(...) })`.

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/lib/api/push-hooks.test.ts`
Expected: FAIL — routes still import/call `sendPush`, so `notify` mock is never called.

- [ ] **Step 3: Update `app/api/swipes/route.ts`**

Change the import (line 5) and the push hook (line 46):

```ts
import { notify } from '@/lib/notifications/notify'
```
```ts
  if (direction === 'right') {
    void notify(swiped_id, {
      type: 'ping',
      title: 'New Ping',
      body: 'Someone wants to connect on Await',
      route: '/discover',
      actorId: user.id,
    })
  }
```

- [ ] **Step 4: Update `app/api/requests/route.ts`**

Change the import (line 3) and the accept hook (line 69):

```ts
import { notify } from '@/lib/notifications/notify'
```
```ts
  if (matchId) {
    void notify(requester_id, {
      type: 'ping_accepted',
      title: 'Ping accepted',
      body: 'Your Ping was accepted — say hi',
      route: `/messages/${matchId}`,
      actorId: user.id,
    })
  }
```

- [ ] **Step 5: Update `app/api/messages/route.ts`**

Change the import (line 4) and the message hook (line 71):

```ts
import { notify } from '@/lib/notifications/notify'
```
```ts
  const recipientId = match.user1_id === user.id ? match.user2_id : match.user1_id
  const snippet = content.trim().slice(0, 80)
  void notify(recipientId, {
    type: 'message',
    title: 'New message',
    body: snippet,
    route: `/messages/${matchId}`,
    actorId: user.id,
  })
```

- [ ] **Step 6: Update `app/api/internal/gideon-push/route.ts`**

Change the import (line 3) and the per-user send (lines 46–56):

```ts
import { notify } from '@/lib/notifications/notify'
```
```ts
      try {
        await notify(user.id, {
          type: 'gideon_post',
          title: `${post.genre}: new post`,
          body: post.title,
          route: `/posts/${post.id}`,
          postId: post.id,
          push: true,
        })
      } catch {
        // best-effort: notify never throws, but guard anyway
      }
      sent++
```

> `notify` here is awaited (matches the existing awaited `sendPush` loop). The row insert + deferred push both run per matching user.

- [ ] **Step 7: Run the push-hooks test to verify it passes**

Run: `npx vitest run tests/lib/api/push-hooks.test.ts`
Expected: PASS (all describe blocks green).

- [ ] **Step 8: Commit**

```bash
git add app/api/swipes/route.ts app/api/requests/route.ts app/api/messages/route.ts app/api/internal/gideon-push/route.ts tests/lib/api/push-hooks.test.ts
git commit -m "feat(notifications): route events through notify() (bell + push)"
```

---

### Task 5: Peer-post fan-out (bell-only, no push)

**Files:**
- Modify: `app/api/posts/route.ts:6,62-69` (add fan-out inside the existing `after(...)`)
- Test: `tests/lib/api/post-fanout.test.ts`

**Interfaces:**
- Consumes: `notify(peerId, { type:'peer_post', ..., push:false })`; the author's matches from the `matches` table.

- [ ] **Step 1: Write the failing test**

Create `tests/lib/api/post-fanout.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { notify, getUser, fromMock, afterFns } = vi.hoisted(() => {
  const notify = vi.fn().mockResolvedValue(undefined)
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'author-1' } } })
  const afterFns: Array<() => Promise<void>> = []
  const fromMock = vi.fn()
  return { notify, getUser, fromMock, afterFns }
})

vi.mock('@/lib/notifications/notify', () => ({ notify }))
vi.mock('next/server', async (orig) => {
  const mod = await (orig as any)()
  return { ...mod, after: (fn: () => Promise<void>) => { afterFns.push(fn) } }
})
vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser }, from: fromMock }),
}))
vi.mock('@/lib/xp/award', () => ({ awardXp: vi.fn().mockResolvedValue(undefined) }))
vi.mock('@/lib/matching/vector', () => ({ updateVector: vi.fn().mockReturnValue({}) }))
vi.mock('@/lib/redis/client', () => ({ rateLimit: vi.fn().mockResolvedValue(true) }))

import { POST as postsPost } from '@/app/api/posts/route'

function req(body: unknown) {
  return new Request('http://localhost/api/posts', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/posts — peer fan-out', () => {
  beforeEach(() => { vi.clearAllMocks(); afterFns.length = 0 })

  it('inserts a bell-only notification for each peer of the author', async () => {
    fromMock.mockImplementation((table: string) => {
      if (table === 'posts') {
        return {
          select: () => ({ eq: () => ({ maybeSingle: () => Promise.resolve({ data: null }) }) }),
          insert: () => ({ select: () => ({ single: () => Promise.resolve({
            data: { id: 'post-1', slug: 'my-post', title: 'My Post' }, error: null }) }) }),
        }
      }
      if (table === 'matches') {
        return { select: () => ({ or: () => Promise.resolve({
          data: [{ user1_id: 'author-1', user2_id: 'peer-A' }, { user1_id: 'peer-B', user2_id: 'author-1' }] }) }) }
      }
      if (table === 'users') {
        return { select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { interest_vector: {} } }) }) }),
                 update: () => ({ eq: () => Promise.resolve({ error: null }) }) }
      }
      return {}
    })

    const res = await postsPost(req({ title: 'My Post', content: 'x', genre: 'tech' }))
    expect(res.status).toBe(201)

    // run the deferred after() side-effects
    for (const fn of afterFns) await fn()

    expect(notify).toHaveBeenCalledTimes(2)
    expect(notify).toHaveBeenCalledWith('peer-A', expect.objectContaining({
      type: 'peer_post', title: 'My Post', route: '/posts/my-post', postId: 'post-1', actorId: 'author-1', push: false,
    }))
    expect(notify).toHaveBeenCalledWith('peer-B', expect.objectContaining({ type: 'peer_post', push: false }))
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/api/post-fanout.test.ts`
Expected: FAIL — posts route does not call `notify`.

- [ ] **Step 3: Add the fan-out to `app/api/posts/route.ts`**

Add the import near the top (after line 6):
```ts
import { notify } from '@/lib/notifications/notify'
```

Extend the existing `after(async () => {...})` block (lines 62–69) to fan out peer-post notifications. The block becomes:

```ts
  // XP + interest-vector are side effects — run after responding so posting feels instant.
  after(async () => {
    await awardXp(user.id, 'post', supabase)
    const { data: profile } = await (supabase as any).from('users').select('interest_vector').eq('id', user.id).single()
    if (profile) {
      const updatedVector = updateVector(profile.interest_vector, genre, 0.15)
      await (supabase as any).from('users').update({ interest_vector: updatedVector }).eq('id', user.id)
    }

    // Bell-only fan-out: tell each Peer (matched user) that the author posted.
    // No push — Peer posts have never pushed (avoids notification spam).
    const { data: matches } = await (supabase as any)
      .from('matches')
      .select('user1_id, user2_id')
      .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    const peerIds = (matches ?? []).map((m: any) => (m.user1_id === user.id ? m.user2_id : m.user1_id))
    await Promise.all(peerIds.map((peerId: string) =>
      notify(peerId, {
        type: 'peer_post',
        title: post.title,
        route: `/posts/${post.slug ?? post.id}`,
        postId: post.id,
        actorId: user.id,
        push: false,
      })
    ))
  })
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/api/post-fanout.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add app/api/posts/route.ts tests/lib/api/post-fanout.test.ts
git commit -m "feat(notifications): fan out bell-only notifications to peers on new post"
```

---

### Task 6: Dismiss API — dismiss by notification id

**Files:**
- Modify: `app/api/notifications/dismiss/route.ts` (full rewrite)
- Test: `tests/lib/api/notifications-dismiss.test.ts`

**Interfaces:**
- Consumes: cookie client; sets `notifications.dismissed_at = now()` for the caller's own row (RLS-guarded).
- Produces: request body shape `{ id: string }` (was `{ postId }`).

- [ ] **Step 1: Write the failing test**

Create `tests/lib/api/notifications-dismiss.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'

const { getUser, updateMock, eqUser, eqId, fromMock } = vi.hoisted(() => {
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'me' } } })
  const eqUser = vi.fn().mockResolvedValue({ error: null })
  const eqId = vi.fn().mockReturnValue({ eq: eqUser })
  const updateMock = vi.fn().mockReturnValue({ eq: eqId })
  const fromMock = vi.fn().mockReturnValue({ update: updateMock })
  return { getUser, updateMock, eqUser, eqId, fromMock }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({ auth: { getUser }, from: fromMock }),
}))

import { POST as dismissPost } from '@/app/api/notifications/dismiss/route'

function req(body: unknown) {
  return new Request('http://localhost/api/notifications/dismiss', {
    method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' },
  })
}

describe('POST /api/notifications/dismiss', () => {
  beforeEach(() => vi.clearAllMocks())

  it('sets dismissed_at on the notification and scopes to the caller', async () => {
    const res = await dismissPost(req({ id: 'notif-1' }))
    expect(res.status).toBe(200)
    expect(fromMock).toHaveBeenCalledWith('notifications')
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({ dismissed_at: expect.any(String) }))
    expect(eqId).toHaveBeenCalledWith('id', 'notif-1')
    expect(eqUser).toHaveBeenCalledWith('user_id', 'me')
  })

  it('400 when id is missing', async () => {
    const res = await dismissPost(req({}))
    expect(res.status).toBe(400)
  })
})
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/lib/api/notifications-dismiss.test.ts`
Expected: FAIL — route still expects `postId` and writes `dismissed_notifications`.

- [ ] **Step 3: Rewrite the route**

Replace the entire contents of `app/api/notifications/dismiss/route.ts`:

```ts
import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Dismiss (hide) a single notification by setting dismissed_at on its row.
// RLS restricts the update to the caller's own rows; the explicit user_id
// filter keeps the intent clear and the update tight.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json().catch(() => ({ id: null }))
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { error } = await (supabase as any)
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dismissed: true })
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/lib/api/notifications-dismiss.test.ts`
Expected: PASS (2 tests).

- [ ] **Step 5: Commit**

```bash
git add app/api/notifications/dismiss/route.ts tests/lib/api/notifications-dismiss.test.ts
git commit -m "feat(notifications): dismiss by notification id (sets dismissed_at)"
```

---

### Task 7: UI — render typed notifications

**Files:**
- Modify: `components/notifications/NotificationsList.tsx`

**Interfaces:**
- Consumes: items of shape `{ id, type, title, body, route, actorName, actorPhoto, created_at, isNew }` from Task 3.
- `NotifBell.tsx`, `MarkNotificationsSeen.tsx`, `app/(app)/notifications/page.tsx`, `app/api/notifications/route.ts`, `app/api/notifications/seen/route.ts` — **unchanged** (unread still comes from `getNotifications().unread`; page still passes `items`).

> This task is UI-only and has no unit test (presentational component; the data layer is covered by Tasks 2–3). Verify by `tsc` + visual smoke in Task 8.

- [ ] **Step 1: Update the `Item` type and dismiss payload**

In `components/notifications/NotificationsList.tsx`, replace the `Item` type (lines 8–16):

```ts
type Item = {
  id: string
  type: string
  title: string
  body: string | null
  route: string | null
  created_at: string
  actorName: string | null
  actorPhoto: string | null
  isNew: boolean
}
```

Update `dismiss()` (lines 24–36) to send `{ id }` instead of `{ postId: id }`:

```ts
  async function dismiss(id: string) {
    setList(prev => prev.filter(i => i.id !== id))
    try {
      await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
    } catch {
      /* best-effort; it'll reappear on next load if the write failed */
    }
  }
```

- [ ] **Step 2: Update `NotificationRow` rendering**

Replace `const href = \`/posts/${n.slug ?? n.id}\`` (line 86) with a route fallback:

```ts
  const href = n.route ?? '/notifications'
```

Replace the avatar + text block (lines 125–135) so it renders title/body and tolerates a null actor:

```tsx
        <div className="w-10 h-10 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep font-display overflow-hidden shrink-0">
          {n.actorPhoto
            ? <img src={n.actorPhoto} alt={n.actorName ?? ''} className="w-10 h-10 object-cover" />
            : (n.actorName?.[0]?.toUpperCase() ?? '•')}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink font-medium truncate">{n.title}</p>
          {n.body && <p className="text-ink-soft text-sm truncate">{n.body}</p>}
        </div>
```

- [ ] **Step 3: Verify types compile**

Run: `npx tsc --noEmit`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add components/notifications/NotificationsList.tsx
git commit -m "feat(notifications): render typed notifications (title/body/route)"
```

---

### Task 8: Full verification + knowledge sync

**Files:**
- Modify: `.knowledge/arch-notifications.md` (overwrite body + restamp)
- Modify: `.knowledge/index.md` (refresh the Notifications line)
- Modify: `.knowledge/log.md` (prepend dated entry)

- [ ] **Step 1: Run the full test suite**

Run: `npm run test`
Expected: all tests pass (existing 69 + new: notify 5, get-notifications 3, post-fanout 1, dismiss 2; push-hooks still green).

- [ ] **Step 2: Typecheck + lint**

Run: `npx tsc --noEmit && npm run lint`
Expected: clean.

- [ ] **Step 3: Smoke-test the bell end-to-end (manual)**

Per `verify` skill: run `npm run dev`, log in as two users; from user A Ping user B → confirm a "New Ping" row appears in user B's bell and the badge increments; accept → "Ping accepted" in A's bell; send a message → "New message" row; create a post → peers see a "posted" row (no phone push). Confirm dismiss removes a row and it stays gone after reload.

- [ ] **Step 4: Update the OKF concept**

Overwrite `.knowledge/arch-notifications.md` body to describe the stored model: `notifications` table (028), `notify()` helper (row insert + push, single source of truth), event sites (swipes/requests/messages/gideon-push/peer-post fan-out), dismissal via `dismissed_at`, unread via `last_notifications_seen`, `dismissed_notifications` dropped. Restamp `timestamp` to `2026-06-29`. Update the Notifications line in `.knowledge/index.md`. Prepend a dated entry under `## 2026-06-29` in `.knowledge/log.md` (newest-first).

- [ ] **Step 5: Commit**

```bash
git add .knowledge/
git commit -m "docs(okf): notifications now stored + event-sourced (028, notify())"
```

---

## Notes / Future Work (out of scope)

- **Message notification volume:** one bell row per message (no collapse/dedup). If noisy, a future iteration can collapse to one "New message" per conversation until read.
- **Block filtering:** `getNotifications` does not hide notifications whose actor was later blocked (own-row model). Add if it becomes a problem.
- **Service-role key dependency:** `notify()` inserts require the correct `SUPABASE_SERVICE_ROLE_KEY` in prod (previously misconfigured — see `arch-push` open thread). Verify before relying on it.
- **FCM topics / digest:** still future work (noted for push generally).
