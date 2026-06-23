import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendPush } from '@/lib/push/send'

// GET: list incoming pings (people who want to chat, awaiting your response)
export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: received }, { data: sent }] = await Promise.all([
    (supabase as any).rpc('get_incoming_requests'),
    (supabase as any).rpc('get_sent_requests'),
  ])
  return NextResponse.json({ received: received ?? [], sent: sent ?? [] })
}

// POST: respond to a ping. { requester_id, action: 'accept' | 'decline' | 'withdraw' }
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { requester_id, action } = await request.json() as { requester_id: string; action: 'accept' | 'decline' | 'withdraw' }
  if (!requester_id || !action) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  // Withdraw cancels a request WE sent — delete our right-swipe on them.
  if (action === 'withdraw') {
    await (supabase as any)
      .from('swipes')
      .delete()
      .eq('swiper_id', user.id)
      .eq('swiped_id', requester_id)
      .eq('direction', 'right')
    return NextResponse.json({ withdrawn: true })
  }

  // Record our response as a swipe so the request is resolved and they don't reappear.
  await (supabase as any)
    .from('swipes')
    .insert({ swiper_id: user.id, swiped_id: requester_id, direction: action === 'accept' ? 'right' : 'left' })

  if (action !== 'accept') {
    return NextResponse.json({ accepted: false })
  }

  // Accepting creates the match (and thus the chat).
  const [u1, u2] = [user.id, requester_id].sort()
  let matchId: string | null = null
  const { data: insertedMatch, error: matchInsertError } = await (supabase as any)
    .from('matches')
    .insert({ user1_id: u1, user2_id: u2 })
    .select('id')
    .single()

  if (matchInsertError) {
    const { data: existingMatch } = await (supabase as any)
      .from('matches')
      .select('id')
      .eq('user1_id', u1)
      .eq('user2_id', u2)
      .single()
    matchId = existingMatch?.id ?? null
  } else {
    matchId = insertedMatch?.id ?? null
  }

  if (matchId) {
    void Promise.resolve().then(() => sendPush(requester_id, { title: 'Ping accepted', body: 'Your Ping was accepted — say hi', route: `/messages/${matchId}` })).catch(() => {})
  }
  return NextResponse.json({ accepted: true, matchId })
}
