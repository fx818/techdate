import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SwipeDeck } from '@/components/dating/SwipeDeck'

export default async function DiscoverPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('dating_unlocked, xp')
    .eq('id', user.id)
    .single()

  if (!profile?.dating_unlocked) {
    return (
      <div className="max-w-xl mx-auto px-4 py-12 text-center space-y-3">
        <h2 className="text-white text-xl font-semibold">Dating is locked</h2>
        <p className="text-gray-400">You need 100 XP to unlock dating. You have {profile?.xp ?? 0} XP.</p>
        <p className="text-gray-500 text-sm">Discuss, post, and comment on the feed to earn XP.</p>
      </div>
    )
  }

  // Fetch candidates directly (same logic as /api/candidates but inline)
  const { data: userProfile } = await (supabase as any)
    .from('users')
    .select('city, gender, preference, xp, interest_vector')
    .eq('id', user.id)
    .single()

  let candidates: any[] = []
  if (userProfile) {
    const genderFilter = userProfile.preference === 'everyone'
      ? ['male', 'female', 'non_binary']
      : [userProfile.preference]

    const { data: rawCandidates } = await (supabase as any)
      .from('users')
      .select('id, interest_vector, xp, last_active, name, photo_url, city, genres, bio')
      .eq('city', userProfile.city)
      .in('gender', genderFilter)
      .neq('id', user.id)
      .limit(50)

    if (rawCandidates) {
      const { rankCandidates } = await import('@/lib/matching/candidates')
      const userCandidate = {
        id: user.id,
        interest_vector: userProfile.interest_vector,
        xp: userProfile.xp,
        last_active: new Date(),
      }
      const ranked = rankCandidates(userCandidate, rawCandidates.map((c: any) => ({
        ...c,
        last_active: new Date(c.last_active),
      })))
      candidates = ranked.slice(0, 20).map((c: any) => rawCandidates.find((r: any) => r.id === c.id))
    }
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-white mb-6">Discover</h1>
      <SwipeDeck initialCandidates={candidates} />
    </div>
  )
}
