import { describe, it, expect, vi, beforeEach } from 'vitest'

// --- mock admin client ---
const mockSelect = vi.fn()
const mockEqUserId = vi.fn()
const mockDelete = vi.fn()
const mockDeleteEqUserId = vi.fn()
const mockDeleteEqToken = vi.fn()

const mockFrom = vi.fn()

vi.mock('@/lib/supabase/admin', () => ({
  createAdminClient: () => ({ from: mockFrom }),
}))

// --- mock fcm ---
const mockSendFcmMessage = vi.fn()

vi.mock('@/lib/push/fcm', () => ({
  sendFcmMessage: (...args: unknown[]) => mockSendFcmMessage(...args),
}))

import { sendPush } from '@/lib/push/send'

beforeEach(() => {
  vi.clearAllMocks()

  // Default: select returns two tokens
  mockSelect.mockResolvedValue({ data: [{ token: 'tok-A' }, { token: 'tok-B' }], error: null })
  mockEqUserId.mockReturnValue({ data: [{ token: 'tok-A' }, { token: 'tok-B' }], error: null })

  // delete chain
  mockDeleteEqToken.mockResolvedValue({ error: null })
  mockDeleteEqUserId.mockReturnValue({ eq: mockDeleteEqToken })
  mockDelete.mockReturnValue({ eq: mockDeleteEqUserId })

  // Default FCM: ok
  mockSendFcmMessage.mockResolvedValue({ ok: true, invalidToken: false })

  // Wire up from()
  mockFrom.mockImplementation((table: string) => {
    if (table === 'device_tokens') {
      return {
        select: () => ({
          eq: () => mockSelect(),
        }),
        delete: () => mockDelete(),
      }
    }
    return {}
  })
})

describe('sendPush', () => {
  it('fans out to multiple tokens', async () => {
    await sendPush('user-1', { title: 'Hi', body: 'There' })

    expect(mockSendFcmMessage).toHaveBeenCalledTimes(2)
    expect(mockSendFcmMessage).toHaveBeenCalledWith('tok-A', {
      title: 'Hi',
      body: 'There',
      data: undefined,
    })
    expect(mockSendFcmMessage).toHaveBeenCalledWith('tok-B', {
      title: 'Hi',
      body: 'There',
      data: undefined,
    })
  })

  it('passes route through data field', async () => {
    await sendPush('user-1', { title: 'Ping', body: 'Someone liked you', route: '/discover' })

    expect(mockSendFcmMessage).toHaveBeenCalledWith('tok-A', {
      title: 'Ping',
      body: 'Someone liked you',
      data: { route: '/discover' },
    })
  })

  it('no-ops cleanly when user has zero tokens', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => Promise.resolve({ data: [], error: null }),
      }),
      delete: () => mockDelete(),
    }))

    await sendPush('user-no-tokens', { title: 'Hi', body: 'There' })

    expect(mockSendFcmMessage).not.toHaveBeenCalled()
    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('prunes invalid token when sendFcmMessage reports invalidToken=true', async () => {
    // tok-A invalid, tok-B ok
    mockSendFcmMessage
      .mockResolvedValueOnce({ ok: false, invalidToken: true })
      .mockResolvedValueOnce({ ok: true, invalidToken: false })

    await sendPush('user-1', { title: 'Hi', body: 'There' })

    expect(mockDelete).toHaveBeenCalledTimes(1)
    expect(mockDeleteEqUserId).toHaveBeenCalledWith('user_id', 'user-1')
    expect(mockDeleteEqToken).toHaveBeenCalledWith('token', 'tok-A')
  })

  it('does not prune valid tokens', async () => {
    await sendPush('user-1', { title: 'Hi', body: 'There' })

    expect(mockDelete).not.toHaveBeenCalled()
  })

  it('never throws when sendFcmMessage throws', async () => {
    mockSendFcmMessage.mockRejectedValue(new Error('FCM exploded'))

    await expect(
      sendPush('user-1', { title: 'Hi', body: 'There' })
    ).resolves.toBeUndefined()
  })

  it('never throws when supabase query fails', async () => {
    mockFrom.mockImplementation(() => ({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: new Error('DB down') }),
      }),
    }))

    await expect(
      sendPush('user-1', { title: 'Hi', body: 'There' })
    ).resolves.toBeUndefined()

    expect(mockSendFcmMessage).not.toHaveBeenCalled()
  })

  it('no-ops when route is undefined (data is undefined)', async () => {
    await sendPush('user-1', { title: 'Hi', body: 'There' })

    const call = mockSendFcmMessage.mock.calls[0]
    expect(call[1].data).toBeUndefined()
  })
})
