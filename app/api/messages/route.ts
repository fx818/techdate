import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'
import { rateLimit } from '@/lib/redis/client'
import { notify } from '@/lib/notifications/notify'

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const matchId = req.nextUrl.searchParams.get('matchId')
  if (!matchId) return NextResponse.json({ error: 'matchId required' }, { status: 400 })

  // Verify user is part of this match
  const { data: match } = await (supabase as any)
    .from('matches')
    .select('user1_id, user2_id')
    .eq('id', matchId)
    .single()

  if (!match || (match.user1_id !== user.id && match.user2_id !== user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: messages } = await (supabase as any)
    .from('messages')
    .select('*, users!messages_sender_id_fkey(name)')
    .eq('match_id', matchId)
    .order('created_at', { ascending: true })
    .limit(100)

  return NextResponse.json({ messages: messages ?? [] })
}

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { matchId, content } = await req.json()
  if (!matchId || !content?.trim()) {
    return NextResponse.json({ error: 'matchId and content required' }, { status: 400 })
  }

  // Anti-spam: cap messages per user per minute (degrades open if Redis is down).
  if (!(await rateLimit('message', user.id, 30, 60))) {
    return NextResponse.json({ error: "You're sending messages too fast. Slow down a moment." }, { status: 429 })
  }

  // Verify user is part of match
  const { data: match } = await (supabase as any)
    .from('matches')
    .select('user1_id, user2_id')
    .eq('id', matchId)
    .single()

  if (!match || (match.user1_id !== user.id && match.user2_id !== user.id)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const { data: message, error: insertError } = await (supabase as any)
    .from('messages')
    .insert({ match_id: matchId, sender_id: user.id, content: content.trim() })
    .select()
    .single()

  if (insertError) return NextResponse.json({ error: 'Failed to send message' }, { status: 500 })

  const recipientId = match.user1_id === user.id ? match.user2_id : match.user1_id
  const snippet = content.trim().slice(0, 80)
  void Promise.resolve().then(() => notify(recipientId, {
    type: 'message',
    title: 'New message',
    body: snippet,
    route: `/messages/${matchId}`,
    actorId: user.id,
  })).catch(() => {})

  return NextResponse.json({ message })
}
