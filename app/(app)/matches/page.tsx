import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function MatchesPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: matches } = await (supabase as any)
    .from('matches')
    .select(`
      id,
      user1_id,
      user2_id,
      matched_at,
      user1:users!matches_user1_id_fkey(id, name, photo_url),
      user2:users!matches_user2_id_fkey(id, name, photo_url)
    `)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('matched_at', { ascending: false })

  return (
    <div className="max-w-xl mx-auto px-4 py-6">
      <h1 className="text-lg font-semibold text-white mb-4">Matches</h1>
      {!matches?.length ? (
        <p className="text-gray-400 text-sm">No matches yet. Keep swiping!</p>
      ) : (
        <div className="space-y-2">
          {matches.map((match: any) => {
            const other = match.user1_id === user.id ? match.user2 : match.user1
            return (
              <Link key={match.id} href={`/messages/${match.id}`}
                className="flex items-center gap-3 bg-gray-900 border border-gray-800 rounded-lg p-3 hover:border-gray-700">
                <div className="w-10 h-10 rounded-full bg-gray-700 flex items-center justify-center text-white font-medium">
                  {other?.photo_url ? (
                    <img src={other.photo_url} className="w-10 h-10 rounded-full object-cover" alt={other.name} />
                  ) : (
                    other?.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-white font-medium">{other?.name}</p>
                  <p className="text-gray-500 text-xs">Tap to chat</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
