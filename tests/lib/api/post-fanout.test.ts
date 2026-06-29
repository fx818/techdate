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
