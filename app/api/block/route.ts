import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_id } = await request.json() as { target_id: string }
  if (!target_id || target_id === user.id) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  const { error } = await (supabase as any)
    .from('blocks').insert({ blocker_id: user.id, blocked_id: target_id })
  const [u1, u2] = [user.id, target_id].sort()
  await (supabase as any).from('matches').delete().eq('user1_id', u1).eq('user2_id', u2)

  if (error && !error.message?.includes('duplicate')) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ blocked: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_id } = await request.json() as { target_id: string }
  if (!target_id) return NextResponse.json({ error: 'Bad request' }, { status: 400 })

  await (supabase as any).from('blocks').delete().eq('blocker_id', user.id).eq('blocked_id', target_id)
  return NextResponse.json({ blocked: false })
}
