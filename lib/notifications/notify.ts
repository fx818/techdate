import { createAdminClient } from '@/lib/supabase/admin'
import { sendPush } from '@/lib/push/send'

export type NotificationType =
  | 'ping' | 'ping_accepted' | 'message' | 'peer_post' | 'gideon_post'

export interface NotifyOpts {
  type: NotificationType
  title: string
  body?: string
  route?: string
  actorId?: string
  postId?: string
  push?: boolean
}

/**
 * Single source of truth for a notable event: persist a bell row AND fire push.
 * The row insert is awaited (cheap, indexed) so the bell never misses an event;
 * push is fired deferred and best-effort. Never throws — callers fire-and-forget.
 * Inserts use the service-role admin client because rows target OTHER users.
 */
export async function notify(userId: string, opts: NotifyOpts): Promise<void> {
  try {
    const admin = createAdminClient()
    const { error } = await (admin as any).from('notifications').insert({
      user_id: userId,
      type: opts.type,
      title: opts.title,
      body: opts.body ?? null,
      route: opts.route ?? null,
      actor_id: opts.actorId ?? null,
      post_id: opts.postId ?? null,
    })
    if (error) return // bell insert failed — bail; nothing reliable to push about.
  } catch {
    return
  }

  if (opts.push === false) return
  void Promise.resolve()
    .then(() => sendPush(userId, { title: opts.title, body: opts.body ?? '', route: opts.route }))
    .catch(() => {})
}
