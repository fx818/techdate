import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'
import { updateVector } from '@/lib/matching/vector'

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: postId } = await params

  const { data: existing } = await (supabase as any).from('likes')
    .select('id').eq('user_id', user.id).eq('post_id', postId).single()

  if (existing) {
    await (supabase as any).from('likes').delete().eq('user_id', user.id).eq('post_id', postId)
    return NextResponse.json({ liked: false })
  }

  await (supabase as any).from('likes').insert({ user_id: user.id, post_id: postId })

  await awardXp(user.id, 'like')

  const { data: post } = await (supabase as any).from('posts').select('genre').eq('id', postId).single()
  if (post) {
    const { data: profile } = await (supabase as any).from('users').select('interest_vector').eq('id', user.id).single()
    if (profile) {
      const updatedVector = updateVector(profile.interest_vector, post.genre, 0.05)
      await (supabase as any).from('users').update({ interest_vector: updatedVector }).eq('id', user.id)
    }
  }

  return NextResponse.json({ liked: true })
}
