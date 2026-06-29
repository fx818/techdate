import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ---------------------------------------------------------------------------
// Hoisted mocks — must be set up before any module imports
// ---------------------------------------------------------------------------
const { notify, getUser, mockFrom } = vi.hoisted(() => {
  const notify = vi.fn().mockResolvedValue(undefined)
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'current-user' } } })

  // Supabase chain helpers — rewired in beforeEach as needed
  const mockSingle = vi.fn()
  const mockSelect = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }) })
  const mockInsert = vi.fn().mockReturnValue({ select: vi.fn().mockReturnValue({ single: mockSingle }) })
  const mockEq = vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ single: mockSingle }), single: mockSingle })
  const mockFrom = vi.fn().mockReturnValue({
    select: mockSelect,
    insert: mockInsert,
    delete: vi.fn().mockReturnValue({ eq: mockEq }),
    eq: mockEq,
  })

  return { notify, getUser, mockFrom, mockSingle, mockSelect, mockInsert, mockEq }
})

vi.mock('@/lib/notifications/notify', () => ({ notify }))

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser },
    from: mockFrom,
  }),
}))

// Redis stubs — swipes route uses getDailySwipeCount / incrementDailySwipeCount
// messages route uses rateLimit
vi.mock('@/lib/redis/client', () => ({
  getDailySwipeCount: vi.fn().mockResolvedValue(0),
  incrementDailySwipeCount: vi.fn().mockResolvedValue(undefined),
  rateLimit: vi.fn().mockResolvedValue(true),
}))

// ---------------------------------------------------------------------------
// Imports AFTER mocks
// ---------------------------------------------------------------------------
import { POST as swipesPost } from '@/app/api/swipes/route'
import { POST as requestsPost } from '@/app/api/requests/route'
import { POST as messagesPost } from '@/app/api/messages/route'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
function jsonRequest(url: string, body: unknown): NextRequest {
  return new NextRequest(url, {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}


// ---------------------------------------------------------------------------
// SWIPES
// ---------------------------------------------------------------------------
describe('POST /api/swipes — notify hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notify.mockResolvedValue(undefined)
    getUser.mockResolvedValue({ data: { user: { id: 'swiper-id' } } })
  })

  it('right-swipe fires notify to swiped_id with type ping + route /discover', async () => {
    // from('users') -> premium check -> { data: { is_premium: false } }
    // from('swipes') -> insert -> { error: null }
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { is_premium: false }, error: null }),
            }),
          }),
        }
      }
      // swipes table
      return {
        insert: vi.fn().mockResolvedValue({ error: null }),
      }
    })

    const req = jsonRequest('http://localhost/api/swipes', { swiped_id: 'target-user', direction: 'right' })
    const res = await swipesPost(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.requested).toBe(true)

    // Give the fire-and-forget microtask a chance to run
    await Promise.resolve()

    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('target-user', {
      type: 'ping',
      title: 'New Ping',
      body: 'Someone wants to connect on Await',
      route: '/discover',
      actorId: 'swiper-id',
    })
  })

  it('left-swipe does NOT call notify', async () => {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { is_premium: false }, error: null }),
            }),
          }),
        }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })

    const req = jsonRequest('http://localhost/api/swipes', { swiped_id: 'target-user', direction: 'left' })
    const res = await swipesPost(req)
    expect(res.status).toBe(200)
    await Promise.resolve()
    expect(notify).not.toHaveBeenCalled()
  })

  it('route still returns 200 even if notify throws synchronously', async () => {
    notify.mockImplementation(() => { throw new Error('boom') })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'users') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: { is_premium: false }, error: null }),
            }),
          }),
        }
      }
      return { insert: vi.fn().mockResolvedValue({ error: null }) }
    })

    const req = jsonRequest('http://localhost/api/swipes', { swiped_id: 'target-user', direction: 'right' })
    const res = await swipesPost(req)
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// REQUESTS
// ---------------------------------------------------------------------------
describe('POST /api/requests — notify hooks', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    notify.mockResolvedValue(undefined)
    getUser.mockResolvedValue({ data: { user: { id: 'acceptor-id' } } })
  })

  function makeRequestsSupabase(matchResult: { data: { id: string } | null; error: unknown }) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'swipes') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === 'matches') {
        const single = vi.fn().mockResolvedValue(matchResult)
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single }),
            }),
          }),
        }
      }
      return {}
    })
  }

  it('accept with new match calls notify(requester_id, type ping_accepted, route /messages/<id>)', async () => {
    makeRequestsSupabase({ data: { id: 'match-abc' }, error: null })

    const req = jsonRequest('http://localhost/api/requests', { requester_id: 'req-user', action: 'accept' })
    const res = await requestsPost(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.accepted).toBe(true)
    expect(json.matchId).toBe('match-abc')

    await Promise.resolve()

    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('req-user', {
      type: 'ping_accepted',
      title: 'Ping accepted',
      body: 'Your Ping was accepted — say hi',
      route: '/messages/match-abc',
      actorId: 'acceptor-id',
    })
  })

  it('decline does NOT call notify', async () => {
    mockFrom.mockImplementation(() => ({
      insert: vi.fn().mockResolvedValue({ error: null }),
    }))

    const req = jsonRequest('http://localhost/api/requests', { requester_id: 'req-user', action: 'decline' })
    const res = await requestsPost(req)
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.accepted).toBe(false)

    await Promise.resolve()
    expect(notify).not.toHaveBeenCalled()
  })

  it('accept when matchId is null (race fallback returned null) does NOT call notify', async () => {
    // match insert fails, fallback select also returns null
    const singleFail = vi.fn().mockResolvedValue({ data: null, error: new Error('dup') })
    const singleFallback = vi.fn().mockResolvedValue({ data: null, error: null })

    mockFrom.mockImplementation((table: string) => {
      if (table === 'swipes') {
        return { insert: vi.fn().mockResolvedValue({ error: null }) }
      }
      if (table === 'matches') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({ single: singleFail }),
          }),
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              eq: vi.fn().mockReturnValue({ single: singleFallback }),
            }),
          }),
        }
      }
      return {}
    })

    const req = jsonRequest('http://localhost/api/requests', { requester_id: 'req-user', action: 'accept' })
    const res = await requestsPost(req)
    expect(res.status).toBe(200)
    await Promise.resolve()
    expect(notify).not.toHaveBeenCalled()
  })

  it('route still returns 200 even if notify throws synchronously', async () => {
    notify.mockImplementation(() => { throw new Error('push-boom') })
    makeRequestsSupabase({ data: { id: 'match-xyz' }, error: null })

    const req = jsonRequest('http://localhost/api/requests', { requester_id: 'req-user', action: 'accept' })
    const res = await requestsPost(req)
    expect(res.status).toBe(200)
  })
})

// ---------------------------------------------------------------------------
// MESSAGES
// ---------------------------------------------------------------------------
describe('POST /api/messages — notify hooks', () => {
  const MATCH_ID = 'match-999'

  beforeEach(() => {
    vi.clearAllMocks()
    notify.mockResolvedValue(undefined)
    getUser.mockResolvedValue({ data: { user: { id: 'user-A' } } })
  })

  function makeMessagesSupabase({
    matchData,
    insertedMessage,
    insertError = null,
  }: {
    matchData: { user1_id: string; user2_id: string } | null
    insertedMessage?: { id: string; content: string }
    insertError?: unknown
  }) {
    mockFrom.mockImplementation((table: string) => {
      if (table === 'matches') {
        return {
          select: vi.fn().mockReturnValue({
            eq: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: matchData, error: matchData ? null : new Error('not found') }),
            }),
          }),
        }
      }
      if (table === 'messages') {
        return {
          insert: vi.fn().mockReturnValue({
            select: vi.fn().mockReturnValue({
              single: vi.fn().mockResolvedValue({ data: insertedMessage ?? null, error: insertError }),
            }),
          }),
        }
      }
      return {}
    })
  }

  it('sends notify to the other match participant with content snippet and correct route', async () => {
    makeMessagesSupabase({
      matchData: { user1_id: 'user-A', user2_id: 'user-B' },
      insertedMessage: { id: 'msg-1', content: 'hello' },
    })

    const req = jsonRequest(`http://localhost/api/messages`, { matchId: MATCH_ID, content: 'hello' })
    const res = await messagesPost(req)
    expect(res.status).toBe(200)

    await Promise.resolve()

    expect(notify).toHaveBeenCalledOnce()
    expect(notify).toHaveBeenCalledWith('user-B', {
      type: 'message',
      title: 'New message',
      body: 'hello',
      route: `/messages/${MATCH_ID}`,
      actorId: 'user-A',
    })
  })

  it('sends to user1 when sender is user2', async () => {
    getUser.mockResolvedValue({ data: { user: { id: 'user-B' } } })
    makeMessagesSupabase({
      matchData: { user1_id: 'user-A', user2_id: 'user-B' },
      insertedMessage: { id: 'msg-2', content: 'hey there' },
    })

    const req = jsonRequest(`http://localhost/api/messages`, { matchId: MATCH_ID, content: 'hey there' })
    const res = await messagesPost(req)
    expect(res.status).toBe(200)

    await Promise.resolve()

    expect(notify).toHaveBeenCalledWith('user-A', expect.objectContaining({ route: `/messages/${MATCH_ID}` }))
  })

  it('trims content to 80 chars for the notify body', async () => {
    const longMsg = 'a'.repeat(120)
    makeMessagesSupabase({
      matchData: { user1_id: 'user-A', user2_id: 'user-B' },
      insertedMessage: { id: 'msg-3', content: longMsg },
    })

    const req = jsonRequest(`http://localhost/api/messages`, { matchId: MATCH_ID, content: longMsg })
    const res = await messagesPost(req)
    expect(res.status).toBe(200)

    await Promise.resolve()

    const call = notify.mock.calls[0]
    expect(call[1].body.length).toBe(80)
  })

  it('does NOT call notify when insert fails', async () => {
    makeMessagesSupabase({
      matchData: { user1_id: 'user-A', user2_id: 'user-B' },
      insertError: new Error('db error'),
    })

    const req = jsonRequest(`http://localhost/api/messages`, { matchId: MATCH_ID, content: 'hi' })
    const res = await messagesPost(req)
    expect(res.status).toBe(500)

    await Promise.resolve()
    expect(notify).not.toHaveBeenCalled()
  })

  it('route still returns 200 even if notify throws synchronously', async () => {
    notify.mockImplementation(() => { throw new Error('push-fail') })
    makeMessagesSupabase({
      matchData: { user1_id: 'user-A', user2_id: 'user-B' },
      insertedMessage: { id: 'msg-4', content: 'test' },
    })

    const req = jsonRequest(`http://localhost/api/messages`, { matchId: MATCH_ID, content: 'test' })
    const res = await messagesPost(req)
    expect(res.status).toBe(200)
  })
})
