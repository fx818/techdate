import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'
import { updateVector } from '@/lib/matching/vector'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data, error } = await (supabase as any)
    .from('comments')
    .select('*, users(id, name, photo_url)')
    .eq('post_id', id)
    .is('parent_id', null)
    .order('created_at', { ascending: true })

  // A malformed/stale post id (invalid UUID) yields a PostgREST error — degrade
  // gracefully to an empty list rather than 500ing and leaking DB internals.
  if (error) return NextResponse.json({ comments: [] })
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: postId } = await params
  const { content, parent_id } = await request.json()
  if (!content) return NextResponse.json({ error: 'Missing content' }, { status: 400 })

  const { data: comment, error } = await (supabase as any).from('comments').insert({
    post_id: postId,
    author_id: user.id,
    parent_id: parent_id ?? null,
    content,
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const action = parent_id ? 'reply' : 'comment'
  await awardXp(user.id, action)

  const { data: post } = await (supabase as any).from('posts').select('genre').eq('id', postId).single()
  if (post) {
    const { data: profile } = await (supabase as any).from('users').select('interest_vector').eq('id', user.id).single()
    if (profile) {
      const increment = action === 'comment' ? 0.1 : 0.07
      const updatedVector = updateVector(profile.interest_vector, post.genre, increment)
      await (supabase as any).from('users').update({ interest_vector: updatedVector }).eq('id', user.id)
    }
  }

  return NextResponse.json({ comment }, { status: 201 })
}
