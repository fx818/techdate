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

  // Compute the day boundary in IST (the audience's local day), not UTC. Using UTC
  // rolled the "day" over at 05:30 IST, which broke/double-counted streaks for
  // anyone active between midnight and 05:30 local. en-CA formats as YYYY-MM-DD;
  // India has no DST, so subtracting 24h always lands on the previous IST date.
  const istDate = (d: Date) =>
    new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
  const today = istDate(new Date())
  if (profile.last_login_date === today) {
    return NextResponse.json({ ok: true, awarded: false, streak: profile.streak_count })
  }

  // Was the previous login exactly yesterday? If so, extend the streak.
  const yesterday = istDate(new Date(Date.now() - 86400000))
  const nextStreak = profile.last_login_date === yesterday ? (profile.streak_count ?? 0) + 1 : 1

  await (supabase as any)
    .from('users')
    .update({ last_login_date: today, streak_count: nextStreak })
    .eq('id', user.id)

  await awardXp(user.id, 'login_streak')

  return NextResponse.json({ ok: true, awarded: true, streak: nextStreak })
}
