import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// vi.hoisted runs before vi.mock factories, so these refs are safe to use inside
const { mockUpsert, mockEqToken, mockEqUserId, mockDelete, mockFrom, getUser } = vi.hoisted(() => {
  const mockUpsert = vi.fn().mockResolvedValue({ error: null })
  const mockEqToken = vi.fn().mockResolvedValue({ error: null })
  const mockEqUserId = vi.fn().mockReturnValue({ eq: mockEqToken })
  const mockDelete = vi.fn().mockReturnValue({ eq: mockEqUserId })
  const mockFrom = vi.fn().mockReturnValue({ upsert: mockUpsert, delete: mockDelete })
  const getUser = vi.fn().mockResolvedValue({ data: { user: { id: 'user-123' } } })
  return { mockUpsert, mockEqToken, mockEqUserId, mockDelete, mockFrom, getUser }
})

vi.mock('@/lib/supabase/server', () => ({
  createClient: vi.fn().mockResolvedValue({
    auth: { getUser },
    from: mockFrom,
  }),
}))

import { POST, DELETE } from '@/app/api/devices/route'

function makeRequest(method: string, body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/devices', {
    method,
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

beforeEach(() => {
  vi.clearAllMocks()
  // Re-wire chains after clearAllMocks resets all mock implementations
  getUser.mockResolvedValue({ data: { user: { id: 'user-123' } } })
  mockEqToken.mockResolvedValue({ error: null })
  mockEqUserId.mockReturnValue({ eq: mockEqToken })
  mockDelete.mockReturnValue({ eq: mockEqUserId })
  mockUpsert.mockResolvedValue({ error: null })
  mockFrom.mockReturnValue({ upsert: mockUpsert, delete: mockDelete })
})

describe('POST /api/devices', () => {
  it('returns 401 when no user', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await POST(makeRequest('POST', { token: 'tok1' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when token is missing', async () => {
    const res = await POST(makeRequest('POST', { platform: 'ios' }))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('token required')
  })

  it('calls upsert with correct payload and onConflict', async () => {
    const res = await POST(makeRequest('POST', { token: 'abc123', platform: 'ios' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.registered).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('device_tokens')
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: 'user-123', token: 'abc123', platform: 'ios' },
      { onConflict: 'user_id,token' }
    )
  })

  it('defaults platform to android when not provided', async () => {
    const res = await POST(makeRequest('POST', { token: 'tok-no-platform' }))
    expect(res.status).toBe(200)
    expect(mockUpsert).toHaveBeenCalledWith(
      { user_id: 'user-123', token: 'tok-no-platform', platform: 'android' },
      { onConflict: 'user_id,token' }
    )
  })
})

describe('DELETE /api/devices', () => {
  it('returns 401 when no user', async () => {
    getUser.mockResolvedValue({ data: { user: null } })
    const res = await DELETE(makeRequest('DELETE', { token: 'tok1' }))
    expect(res.status).toBe(401)
    const json = await res.json()
    expect(json.error).toBe('Unauthorized')
  })

  it('returns 400 when token is missing', async () => {
    const res = await DELETE(makeRequest('DELETE', {}))
    expect(res.status).toBe(400)
    const json = await res.json()
    expect(json.error).toBe('token required')
  })

  it("deletes only caller's token via chained eq calls", async () => {
    const res = await DELETE(makeRequest('DELETE', { token: 'tok-to-delete' }))
    expect(res.status).toBe(200)
    const json = await res.json()
    expect(json.deregistered).toBe(true)
    expect(mockFrom).toHaveBeenCalledWith('device_tokens')
    expect(mockDelete).toHaveBeenCalled()
    expect(mockEqUserId).toHaveBeenCalledWith('user_id', 'user-123')
    expect(mockEqToken).toHaveBeenCalledWith('token', 'tok-to-delete')
  })
})
