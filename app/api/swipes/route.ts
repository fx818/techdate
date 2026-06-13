import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getDailySwipeCount, incrementDailySwipeCount } from '@/lib/redis/client'
import type { SwipeDirection } from '@/lib/supabase/types'

const FREE_SWIPE_LIMIT = 10

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { swiped_id, direction } = await request.json() as { swiped_id: string; direction: SwipeDirection }
  if (!swiped_id || !direction) return NextResponse.json({ error: 'Missing fields' }, { status: 400 })

  const { data: profile } = await (supabase as any).from('users').select('is_premium, dating_unlocked').eq('id', user.id).single()
  if (!profile?.dating_unlocked) return NextResponse.json({ error: 'Dating not unlocked' }, { status: 403 })

  if (!profile.is_premium) {
    const swipeCount = await getDailySwipeCount(user.id)
    if (swipeCount >= FREE_SWIPE_LIMIT) {
      return NextResponse.json({ error: 'Daily swipe limit reached', upgrade: true }, { status: 429 })
    }
  }

  const { error } = await (supabase as any).from('swipes').insert({
    swiper_id: user.id,
    swiped_id,
    direction,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  await incrementDailySwipeCount(user.id)

  if (direction === 'right') {
    const { data: theirSwipe } = await (supabase as any)
      .from('swipes')
      .select('id')
      .eq('swiper_id', swiped_id)
      .eq('swiped_id', user.id)
      .eq('direction', 'right')
      .single()

    if (theirSwipe) {
      const [u1, u2] = [user.id, swiped_id].sort()
      const { data: match } = await (supabase as any).from('matches').insert({
        user1_id: u1,
        user2_id: u2,
      }).select().single()

      return NextResponse.json({ match: true, matchId: match?.id })
    }
  }

  return NextResponse.json({ match: false })
}
