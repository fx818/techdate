import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SwipeDeck } from '@/components/dating/SwipeDeck'

export default async function PeoplePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('xp, city, interest_vector')
    .eq('id', user.id)
    .single()

  let candidates: any[] = []
  try {
    // Exclude from the deck:
    //  • people who already pinged you (they belong in Pings)
    //  • people you've already pinged/skipped (you've acted on them)
    //  • people you're already connected with
    //  • blocked users
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
    <div className="max-w-xl mx-auto px-4 py-7">
      <div className="mb-5">
        <h1 className="font-display text-3xl text-ink leading-none">People</h1>
        <p className="text-ink-faint text-sm mt-1.5">Techies in {profile.city} who share your interests. Ping someone to start a chat.</p>
      </div>
      <SwipeDeck initialCandidates={candidates} />
    </div>
  )
}
