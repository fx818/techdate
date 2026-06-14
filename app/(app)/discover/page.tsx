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

    // People who already liked you belong in Requests, not the deck.
    const { data: incoming } = await (supabase as any).rpc('get_incoming_requests')
    const requesterIds: string[] = (incoming ?? []).map((r: any) => r.id)

    let q = (supabase as any)
      .from('users')
      .select('id, interest_vector, xp, last_active, name, photo_url, city, genres, bio')
      .eq('city', profile.city)
      .in('gender', genderFilter)
      .neq('id', user.id)
      .limit(50)

    if (requesterIds.length > 0) {
      q = q.not('id', 'in', `(${requesterIds.map((id) => `"${id}"`).join(',')})`)
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
      <div className="mb-6">
        <h1 className="font-display text-3xl text-ink leading-none">Discover</h1>
        <p className="text-ink-faint text-sm mt-1.5">People who think like you do.</p>
      </div>
      <SwipeDeck initialCandidates={candidates} />
    </div>
  )
}
