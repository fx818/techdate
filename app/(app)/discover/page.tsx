import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SwipeDeck } from '@/components/dating/SwipeDeck'

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('dating_unlocked, xp, city, gender, preference, interest_vector')
    .eq('id', user.id)
    .single()

  if (!profile?.dating_unlocked) {
    const xp = profile?.xp ?? 0
    return (
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-5">
        <div className="font-display text-5xl text-clay/70">✦</div>
        <h2 className="font-display text-3xl text-ink">Dating is locked</h2>
        <p className="text-ink-soft">You need 100 XP to unlock dating — you have <span className="font-mono text-clay-deep">{xp}</span>.</p>
        <div className="h-2 rounded-full bg-line overflow-hidden max-w-xs mx-auto">
          <div className="h-full bg-clay rounded-full transition-all" style={{ width: `${Math.min(100, xp)}%` }} />
        </div>
        <p className="text-ink-faint text-sm">Discuss, post, and comment on the feed to earn XP.</p>
      </div>
    )
  }

  let candidates: any[] = []
  try {
    const genderFilter = profile.preference === 'everyone'
      ? ['male', 'female', 'non_binary']
      : [profile.preference]

    // Exclude from the deck:
    //  • people who already liked you (they belong in Requests)
    //  • people you've already swiped (you've acted on them)
    //  • people you're already matched/connected with
    const [{ data: incoming }, { data: mySwipes }, { data: myMatches }, { data: blocked }] = await Promise.all([
      (supabase as any).rpc('get_incoming_requests'),
      (supabase as any).from('swipes').select('swiped_id').eq('swiper_id', user.id),
      (supabase as any).from('matches').select('user1_id, user2_id').or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`),
      (supabase as any).rpc('get_blocked_ids'),
    ])

    const requesterIds: string[] = (incoming ?? []).map((r: any) => r.id)
    const swipedIds: string[] = (mySwipes ?? []).map((s: any) => s.swiped_id)
    const matchedIds: string[] = (myMatches ?? []).map((m: any) => (m.user1_id === user.id ? m.user2_id : m.user1_id))
    const blockedIds: string[] = (blocked ?? []).map((b: any) => b.user_id)
    const excludeIds = Array.from(new Set([...requesterIds, ...swipedIds, ...matchedIds, ...blockedIds]))

    let q = (supabase as any)
      .from('users')
      .select('id, interest_vector, xp, last_active, name, photo_url, photos, city, genres, bio')
      .eq('city', profile.city)
      .in('gender', genderFilter)
      .neq('id', user.id)
      .limit(50)

    if (excludeIds.length > 0) {
      q = q.not('id', 'in', `(${excludeIds.map((id) => `"${id}"`).join(',')})`)
    }

    const { data: rawCandidates } = await q

    if (rawCandidates) {
      const { rankCandidates } = await import('@/lib/matching/candidates')
      const userCandidate = {
        id: user.id,
        interest_vector: profile.interest_vector,
        xp: profile.xp,
        last_active: new Date(),
      }
      const ranked = rankCandidates(userCandidate, rawCandidates.map((c: any) => ({
        ...c,
        last_active: new Date(c.last_active),
      })))
      candidates = ranked.slice(0, 20)
        .map((c: any) => rawCandidates.find((r: any) => r.id === c.id))
        .filter(Boolean)
    }
  } catch {
    candidates = []
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-8">
      <SwipeDeck initialCandidates={candidates} />
    </div>
  )
}
