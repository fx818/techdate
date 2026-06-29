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
