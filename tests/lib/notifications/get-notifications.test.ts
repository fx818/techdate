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
