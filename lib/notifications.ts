// In-app notification center: reads the stored `notifications` table.
// Unread is derived from users.last_notifications_seen (badge clears when the
// notifications page is opened). Inserts happen via lib/notifications/notify.ts.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function getNotifications(supabase: any, userId: string) {
  const { data: profile } = await supabase
    .from('users').select('last_notifications_seen').eq('id', userId).single()
  const lastSeen = profile?.last_notifications_seen
    ? new Date(profile.last_notifications_seen).getTime() : 0

  // actor is disambiguated by FK name because notifications has TWO FKs to users
  // (user_id + actor_id) — an un-hinted users(...) embed would be ambiguous.
  const { data: rows } = await supabase
    .from('notifications')
    .select('id, type, title, body, route, created_at, actor:users!notifications_actor_id_fkey(name, photo_url)')
    .eq('user_id', userId)
    .is('dismissed_at', null)
    .order('created_at', { ascending: false })
    .limit(30)

  const items = (rows ?? []).map((r: any) => ({
    id: r.id,
    type: r.type,
    title: r.title,
    body: r.body ?? null,
    route: r.route ?? null,
    actorName: r.actor?.name ?? null,
    actorPhoto: r.actor?.photo_url ?? null,
    created_at: r.created_at,
    isNew: new Date(r.created_at).getTime() > lastSeen,
  }))

  return { items, unread: items.filter((i: any) => i.isNew).length }
}
