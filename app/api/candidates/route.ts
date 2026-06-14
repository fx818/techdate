import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { rankCandidates, type Candidate } from '@/lib/matching/candidates'

const XP_TIER_BREAKPOINTS = [0, 50, 150, 350, 700]

function getXpTier(xp: number): number {
  return XP_TIER_BREAKPOINTS.reduce((tier, min, i) => (xp >= min ? i : tier), 0)
}

function getXpTierBandRange(xp: number): [number, number] {
  const tier = getXpTier(xp)
  const min = XP_TIER_BREAKPOINTS[Math.max(0, tier - 1)] ?? 0
  const max = XP_TIER_BREAKPOINTS[tier + 2] ?? 99999
  return [min, max]
}

export async function GET() {
  const supabase = (await createClient()) as any
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabase
    .from('users')
    .select('city, gender, preference, xp, interest_vector, dating_unlocked')
    .eq('id', user.id)
    .single()

  if (!profile) return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  if (!profile.dating_unlocked) return NextResponse.json({ error: 'Dating not unlocked' }, { status: 403 })

  const genderFilter = profile.preference === 'everyone'
    ? ['male', 'female', 'non_binary']
    : [profile.preference]

  const [xpMin, xpMax] = getXpTierBandRange(profile.xp)

  const { data: swiped } = await supabase
    .from('swipes')
    .select('swiped_id')
    .eq('swiper_id', user.id)

  const swipedIds = (swiped ?? []).map((s: any) => s.swiped_id)

  let query = supabase
    .from('users')
    .select('id, interest_vector, xp, last_active, name, photo_url, city, genres, bio')
    .eq('city', profile.city)
    .in('gender', genderFilter)
    .gte('xp', xpMin)
    .lte('xp', xpMax)
    .neq('id', user.id)
    .limit(100)

  if (swipedIds.length > 0) {
    query = query.not('id', 'in', `(${swipedIds.map((id: string) => `"${id}"`).join(',')})`)
  }

  const { data: rawCandidates } = await query

  if (!rawCandidates || rawCandidates.length === 0) {
    return NextResponse.json({ candidates: [] })
  }

  const candidates: Candidate[] = rawCandidates.map((c: any) => ({
    id: c.id,
    interest_vector: c.interest_vector,
    xp: c.xp,
    last_active: new Date(c.last_active),
  }))

  const userCandidate: Candidate = {
    id: user.id,
    interest_vector: profile.interest_vector,
    xp: profile.xp,
    last_active: new Date(),
  }

  const ranked = rankCandidates(userCandidate, candidates)
  const rankedWithData = ranked.map((c: any) => rawCandidates.find((r: any) => r.id === c.id))

  return NextResponse.json({ candidates: rankedWithData.slice(0, 20) })
}
