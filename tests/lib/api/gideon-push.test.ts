import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// --- hoisted mocks ---
const { mockNotify, mockFrom, mockSelect } = vi.hoisted(() => {
  const mockSelect = vi.fn()
  const mockFrom = vi.fn().mockReturnValue({ select: mockSelect })
  const mockNotify = vi.fn().mockResolvedValue(undefined)
  return { mockNotify, mockFrom, mockSelect }
})

vi.mock('@/lib/notifications/notify', () => ({
  notify: (...args: unknown[]) => mockNotify(...args),
}))

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}))

import { POST } from '@/app/api/internal/gideon-push/route'

const CORRECT_SECRET = 'test-secret-abc'

function makeRequest(
  body: unknown,
  secret?: string,
  method = 'POST'
): NextRequest {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (secret !== undefined) {
    headers['x-gideon-secret'] = secret
  }
  return new NextRequest('http://localhost/api/internal/gideon-push', {
    method,
    body: JSON.stringify(body),
    headers,
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  vi.stubEnv('GIDEON_PUSH_SECRET', CORRECT_SECRET)

  // Default: two users — one matches 'ai', one matches 'webdev'
  mockSelect.mockResolvedValue({
    data: [
      { id: 'user-ai', interest_vector: { ai: 0.8, ml: 0.2 } },
      { id: 'user-webdev', interest_vector: { webdev: 0.6, css: 0.4 } },
    ],
    error: null,
  })
  mockFrom.mockReturnValue({ select: mockSelect })
  mockNotify.mockResolvedValue(undefined)
})

describe('POST /api/internal/gideon-push', () => {
  describe('auth guard', () => {
    it('returns 401 when x-gideon-secret header is missing', async () => {
      const res = await POST(makeRequest({ posts: [] }))
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe('Forbidden')
    })

    it('returns 401 when x-gideon-secret header is wrong', async () => {
      const res = await POST(makeRequest({ posts: [] }, 'wrong-secret'))
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe('Forbidden')
    })

    it('returns 401 when GIDEON_PUSH_SECRET env var is unset (fail closed)', async () => {
      vi.stubEnv('GIDEON_PUSH_SECRET', '')
      const res = await POST(makeRequest({ posts: [] }, CORRECT_SECRET))
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe('Forbidden')
    })

    it('returns 401 when GIDEON_PUSH_SECRET env var is not set at all', async () => {
      vi.unstubAllEnvs()
      const res = await POST(makeRequest({ posts: [] }, CORRECT_SECRET))
      expect(res.status).toBe(401)
      const json = await res.json()
      expect(json.error).toBe('Forbidden')
    })
  })

  describe('empty / missing posts', () => {
    it('returns { sent: 0 } when posts array is empty', async () => {
      const res = await POST(makeRequest({ posts: [] }, CORRECT_SECRET))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.sent).toBe(0)
      expect(mockNotify).not.toHaveBeenCalled()
    })

    it('returns { sent: 0 } when posts key is missing from body', async () => {
      const res = await POST(makeRequest({}, CORRECT_SECRET))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.sent).toBe(0)
    })

    it('returns { sent: 0 } when body is null', async () => {
      const res = await POST(makeRequest(null, CORRECT_SECRET))
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.sent).toBe(0)
    })
  })

  describe('genre matching', () => {
    it('sends push only to users whose interest_vector has the post genre', async () => {
      const res = await POST(
        makeRequest(
          { posts: [{ id: 'p1', title: 'AI is fun', genre: 'ai' }] },
          CORRECT_SECRET
        )
      )
      expect(res.status).toBe(200)
      const json = await res.json()
      expect(json.sent).toBe(1)

      expect(mockNotify).toHaveBeenCalledTimes(1)
      expect(mockNotify).toHaveBeenCalledWith('user-ai', {
        type: 'gideon_post',
        title: 'ai: new post',
        body: 'AI is fun',
        route: '/posts/p1',
        postId: 'p1',
        push: true,
      })
    })

    it('skips users whose interest_vector does NOT have the post genre', async () => {
      await POST(
        makeRequest(
          { posts: [{ id: 'p1', title: 'AI is fun', genre: 'ai' }] },
          CORRECT_SECRET
        )
      )
      // user-webdev should NOT be called
      expect(mockNotify).not.toHaveBeenCalledWith(
        'user-webdev',
        expect.anything()
      )
    })

    it('fans out to all matching users across multiple posts', async () => {
      const res = await POST(
        makeRequest(
          {
            posts: [
              { id: 'p1', title: 'AI is fun', genre: 'ai' },
              { id: 'p2', title: 'New CSS tricks', genre: 'webdev' },
            ],
          },
          CORRECT_SECRET
        )
      )
      const json = await res.json()
      expect(json.sent).toBe(2)
      expect(mockNotify).toHaveBeenCalledTimes(2)
    })

    it('skips users with null interest_vector', async () => {
      mockSelect.mockResolvedValue({
        data: [
          { id: 'user-null-iv', interest_vector: null },
          { id: 'user-ai', interest_vector: { ai: 0.8 } },
        ],
        error: null,
      })

      const res = await POST(
        makeRequest(
          { posts: [{ id: 'p1', title: 'AI stuff', genre: 'ai' }] },
          CORRECT_SECRET
        )
      )
      const json = await res.json()
      expect(json.sent).toBe(1)
      expect(mockNotify).toHaveBeenCalledWith('user-ai', expect.anything())
      expect(mockNotify).not.toHaveBeenCalledWith('user-null-iv', expect.anything())
    })

    it('skips users with non-object interest_vector (array)', async () => {
      mockSelect.mockResolvedValue({
        data: [
          { id: 'user-array-iv', interest_vector: ['ai', 'ml'] },
          { id: 'user-ai', interest_vector: { ai: 0.9 } },
        ],
        error: null,
      })

      const res = await POST(
        makeRequest(
          { posts: [{ id: 'p1', title: 'AI stuff', genre: 'ai' }] },
          CORRECT_SECRET
        )
      )
      const json = await res.json()
      expect(json.sent).toBe(1)
    })
  })

  describe('resilience', () => {
    it('continues sending to other users when sendPush throws for one', async () => {
      mockSelect.mockResolvedValue({
        data: [
          { id: 'user-ai-1', interest_vector: { ai: 0.5 } },
          { id: 'user-ai-2', interest_vector: { ai: 0.5 } },
        ],
        error: null,
      })

      mockNotify
        .mockRejectedValueOnce(new Error('FCM down'))
        .mockResolvedValueOnce(undefined)

      const res = await POST(
        makeRequest(
          { posts: [{ id: 'p1', title: 'AI news', genre: 'ai' }] },
          CORRECT_SECRET
        )
      )
      const json = await res.json()
      // Both were attempted
      expect(json.sent).toBe(2)
      expect(mockNotify).toHaveBeenCalledTimes(2)
    })

    it('returns { sent: 0 } when supabase query fails', async () => {
      mockSelect.mockResolvedValue({ data: null, error: new Error('DB down') })

      const res = await POST(
        makeRequest(
          { posts: [{ id: 'p1', title: 'AI news', genre: 'ai' }] },
          CORRECT_SECRET
        )
      )
      const json = await res.json()
      expect(json.sent).toBe(0)
      expect(mockNotify).not.toHaveBeenCalled()
    })
  })
})
