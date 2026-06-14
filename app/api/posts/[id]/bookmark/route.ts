import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: postId } = await params

  const { data: existing } = await (supabase as any).from('bookmarks')
    .select('id').eq('user_id', user.id).eq('post_id', postId).maybeSingle()

  if (existing) {
    await (supabase as any).from('bookmarks').delete().eq('user_id', user.id).eq('post_id', postId)
    return NextResponse.json({ bookmarked: false })
  }

  const { error } = await (supabase as any).from('bookmarks').insert({ user_id: user.id, post_id: postId })
  // Duplicate (race) → treat as bookmarked
  if (error) return NextResponse.json({ bookmarked: true })
  return NextResponse.json({ bookmarked: true })
}
