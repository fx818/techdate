import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDailySwipeCount, incrementDailySwipeCount } from '@/lib/redis/client'
import type { SwipeDirection } from '@/lib/supabase/types'
import { sendPush } from '@/lib/push/send'

const FREE_SWIPE_LIMIT = 10

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { swiped_id, direction } = await request.json() as { swiped_id: string; direction: SwipeDirection }
  if (!swiped_id || !direction) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: profile } = await (supabase as any).from('users').select('is_premium').eq('id', user.id).single()

  // Redis (daily ping cap) is best-effort: if it's unavailable, never block
  // the ping over a rate-limit check — degrade open rather than 500.
  if (!profile?.is_premium) {
    try {
      const swipeCount = await getDailySwipeCount(user.id)
      if (swipeCount >= FREE_SWIPE_LIMIT) {
        return NextResponse.json({ error: 'Daily swipe limit reached', upgrade: true }, { status: 429 })
      }
    } catch (e) {
      console.error('swipe limit check failed (allowing swipe):', e)
    }
  }

  const { error } = await (supabase as any).from('swipes').insert({
    swiper_id: user.id,
    swiped_id,
    direction,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  try {
    await incrementDailySwipeCount(user.id)
  } catch (e) {
    console.error('swipe counter increment failed:', e)
  }

  if (direction === 'right') {
    void Promise.resolve().then(() => sendPush(swiped_id, { title: 'New Ping', body: 'Someone wants to connect on Await', route: '/discover' })).catch(() => {})
  }

  // Pure request/accept model: a right-swipe sends a request. It does NOT
  // create a match — the recipient must accept it from their Requests page.
  return NextResponse.json({ requested: direction === 'right' })
}
