/**
 * Tests for lib/push/fcm.ts
 *
 * Strategy: RSA signing with node:crypto cannot be reliably mocked in Vitest for
 * built-in modules. Instead we use the exported _setTokenFetcher helper to inject
 * a fake access-token provider, bypassing the JWT/OAuth path entirely. We then stub
 * globalThis.fetch to control FCM HTTP responses.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { sendFcmMessage, _resetTokenCache, _setTokenFetcher } from '@/lib/push/fcm'

beforeEach(() => {
  _resetTokenCache()
  // Bypass real OAuth / RSA signing
  _setTokenFetcher(async () => 'test-access-token')
  process.env.FCM_PROJECT_ID = 'test-project-123'
  process.env.FCM_CLIENT_EMAIL = 'test@example.iam.gserviceaccount.com'
  process.env.FCM_PRIVATE_KEY = 'fake-key'
})

afterEach(() => {
  _resetTokenCache() // also clears _setTokenFetcher
  vi.unstubAllGlobals()
})

/** Stub globalThis.fetch for a single FCM send response. */
function mockFcmResponse(status: number, body: unknown): ReturnType<typeof vi.fn> {
  const mockFetch = vi.fn().mockResolvedValueOnce({
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response)
  vi.stubGlobal('fetch', mockFetch)
  return mockFetch
}

describe('sendFcmMessage', () => {
  it('returns ok=true on a 2xx FCM response', async () => {
    mockFcmResponse(200, { name: 'projects/test/messages/123' })

    const result = await sendFcmMessage('device-token-abc', { title: 'Hello', body: 'World' })

    expect(result).toEqual({ ok: true, invalidToken: false })
  })

  it('returns invalidToken=true on a 404 response', async () => {
    mockFcmResponse(404, {})

    const result = await sendFcmMessage('bad-token', { title: 'Hi', body: 'There' })

    expect(result).toEqual({ ok: false, invalidToken: true })
  })

  it('returns invalidToken=true on 400 with UNREGISTERED error code', async () => {
    mockFcmResponse(400, { error: { details: [{ errorCode: 'UNREGISTERED' }] } })

    const result = await sendFcmMessage('old-token', { title: 'Hi', body: 'There' })

    expect(result).toEqual({ ok: false, invalidToken: true })
  })

  it('returns invalidToken=true on 400 with INVALID_ARGUMENT error code', async () => {
    mockFcmResponse(400, { error: { details: [{ errorCode: 'INVALID_ARGUMENT' }] } })

    const result = await sendFcmMessage('bad-token', { title: 'Hi', body: 'There' })

    expect(result).toEqual({ ok: false, invalidToken: true })
  })

  it('returns ok=false, invalidToken=false on 500 error', async () => {
    mockFcmResponse(500, {})

    const result = await sendFcmMessage('token', { title: 'Hi', body: 'There' })

    expect(result).toEqual({ ok: false, invalidToken: false })
  })

  it('never throws on network error', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('Network failure')))

    await expect(
      sendFcmMessage('token', { title: 'Hi', body: 'There' })
    ).resolves.toEqual({ ok: false, invalidToken: false })
  })

  it('passes data.route through to the FCM message body', async () => {
    const mockFetch = mockFcmResponse(200, {})

    await sendFcmMessage('tok123', {
      title: 'New message',
      body: 'Say hi',
      data: { route: '/messages/match-1' },
    })

    expect(mockFetch).toHaveBeenCalledTimes(1)
    const call = mockFetch.mock.calls[0]
    const sentBody = JSON.parse(call[1]?.body as string)
    expect(sentBody.message.data).toEqual({ route: '/messages/match-1' })
    expect(sentBody.message.token).toBe('tok123')
  })

  it('sends correct Authorization header with Bearer token', async () => {
    const mockFetch = mockFcmResponse(200, {})

    await sendFcmMessage('tok-abc', { title: 'T', body: 'B' })

    const headers = mockFetch.mock.calls[0][1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer test-access-token')
  })

  it('targets the correct FCM endpoint for the project', async () => {
    const mockFetch = mockFcmResponse(200, {})

    await sendFcmMessage('tok-abc', { title: 'T', body: 'B' })

    const url = mockFetch.mock.calls[0][0] as string
    expect(url).toContain('test-project-123')
    expect(url).toContain('messages:send')
  })
})
