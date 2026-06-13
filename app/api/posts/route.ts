import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'
import { updateVector } from '@/lib/matching/vector'

export async function GET(request: Request) {
  const supabase = await createClient()
  const { searchParams } = new URL(request.url)
  const genres = searchParams.get('genres')?.split(',') ?? []
  const cursor = searchParams.get('cursor')

  let query = (supabase as any)
    .from('posts')
    .select('*, users(id, name, photo_url, xp)')
    .order('created_at', { ascending: false })
    .limit(20)

  if (genres.length > 0) query = query.in('genre', genres)
  if (cursor) query = query.lt('created_at', cursor)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ posts: data })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { title, content, genre } = await request.json()
  if (!title || !genre) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: post, error } = await (supabase as any).from('posts').insert({
    author_id: user.id,
    is_gideon: false,
    title,
    content,
    genre,
    source: 'user',
  }).select().single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await awardXp(user.id, 'post')

  const { data: profile } = await (supabase as any).from('users').select('interest_vector').eq('id', user.id).single()
  if (profile) {
    const updatedVector = updateVector(profile.interest_vector, genre, 0.15)
    await (supabase as any).from('users').update({ interest_vector: updatedVector }).eq('id', user.id)
  }

  return NextResponse.json({ post }, { status: 201 })
}
