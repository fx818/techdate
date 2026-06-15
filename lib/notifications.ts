// Computes "a person you matched with posted something" notifications.
// No notifications table needed: derive from matches + posts, with unread
// determined by the user's last_notifications_seen timestamp.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getNotifications(supabase: any, userId: string) {
  const { data: matches } = await supabase
    .from('matches')
    .select('user1_id, user2_id')
    .or(`user1_id.eq.${userId},user2_id.eq.${userId}`)

  const otherIds = (matches ?? []).map((m: any) => (m.user1_id === userId ? m.user2_id : m.user1_id))
  if (otherIds.length === 0) return { items: [], unread: 0 }

  const { data: blocked } = await supabase.rpc('get_blocked_ids')
  const blockedIds = new Set((blocked ?? []).map((b: any) => b.user_id))
  const visibleIds = otherIds.filter((id: string) => !blockedIds.has(id))
  if (visibleIds.length === 0) return { items: [], unread: 0 }

  const { data: profile } = await supabase
    .from('users').select('last_notifications_seen').eq('id', userId).single()
  const lastSeen = profile?.last_notifications_seen ? new Date(profile.last_notifications_seen).getTime() : 0

  const { data: posts } = await supabase
    .from('posts')
    .select('id, slug, title, created_at, users(id, name, photo_url)')
    .in('author_id', visibleIds)
    .eq('is_gideon', false)
    .order('created_at', { ascending: false })
    .limit(30)

  const items = (posts ?? []).map((p: any) => ({
    id: p.id,
    slug: p.slug,
    title: p.title,
    created_at: p.created_at,
    authorName: p.users?.name ?? 'Someone',
    authorPhoto: p.users?.photo_url ?? null,
    isNew: new Date(p.created_at).getTime() > lastSeen,
  }))

  return { items, unread: items.filter((i: any) => i.isNew).length }
}
