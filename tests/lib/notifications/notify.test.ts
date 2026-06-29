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
