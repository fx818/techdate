import { NextResponse, after } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'
import { updateVector } from '@/lib/matching/vector'
import { rateLimit } from '@/lib/redis/client'

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { id } = await params
  const { data, error } = await (supabase as any)
    .from('comments')
    .select('id, content, created_at, parent_id, author_id, users(id, name, photo_url)')
    .eq('post_id', id)
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

  // Anti-spam: cap comments per user per hour (degrades open if Redis is down).
  if (!(await rateLimit('comment', user.id, 30, 3600))) {
    return NextResponse.json({ error: "You're commenting too fast. Take a breather and try again shortly." }, { status: 429 })
  }

  const { id: postId } = await params
  const { content, parent_id } = await request.json()
  if (!content) return NextResponse.json({ error: 'Missing content' }, { status: 400 })

  // Return the joined author so the client renders the real name/photo immediately
  // (without it, freshly-posted comments fall back to "User" until a refetch).
  const { data: comment, error } = await (supabase as any).from('comments').insert({
    post_id: postId,
    author_id: user.id,
    parent_id: parent_id ?? null,
    content,
  }).select('id, content, created_at, parent_id, author_id, users(id, name, photo_url)').single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const action = parent_id ? 'reply' : 'comment'

  // XP + interest-vector are side effects — run after responding so the comment posts instantly.
  after(async () => {
    await awardXp(user.id, action, supabase)
    const { data: post } = await (supabase as any).from('posts').select('genre').eq('id', postId).single()
    if (post) {
      const { data: profile } = await (supabase as any).from('users').select('interest_vector').eq('id', user.id).single()
      if (profile) {
        const increment = action === 'comment' ? 0.1 : 0.07
        const updatedVector = updateVector(profile.interest_vector, post.genre, increment)
        await (supabase as any).from('users').update({ interest_vector: updatedVector }).eq('id', user.id)
      }
    }
  })

  return NextResponse.json({ comment }, { status: 201 })
}
