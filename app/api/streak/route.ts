import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'

// Awards login-streak XP at most once per calendar day and maintains a
// consecutive-day streak counter. Idempotent: repeat calls the same day no-op.
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('last_login_date, streak_count')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ ok: false })

  const today = new Date().toISOString().slice(0, 10)
  if (profile.last_login_date === today) {
    return NextResponse.json({ ok: true, awarded: false, streak: profile.streak_count })
  }

  // Was the previous login exactly yesterday? If so, extend the streak.
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
  const nextStreak = profile.last_login_date === yesterday ? (profile.streak_count ?? 0) + 1 : 1

  await (supabase as any)
    .from('users')
    .update({ last_login_date: today, streak_count: nextStreak })
    .eq('id', user.id)

  await awardXp(user.id, 'login_streak')

  return NextResponse.json({ ok: true, awarded: true, streak: nextStreak })
}
