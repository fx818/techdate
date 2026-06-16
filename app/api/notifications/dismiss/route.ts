import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Dismiss (delete) a single notification. Notifications are derived from peers'
// posts, so we record the (user, post) pair in dismissed_notifications and
// getNotifications() filters it out. Idempotent: the PK upsert ignores repeats.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { postId } = await request.json().catch(() => ({ postId: null }))
  if (!postId || typeof postId !== 'string') {
    return NextResponse.json({ error: 'postId required' }, { status: 400 })
  }

  const { error } = await (supabase as any)
    .from('dismissed_notifications')
    .upsert({ user_id: user.id, post_id: postId }, { onConflict: 'user_id,post_id' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dismissed: true })
}
