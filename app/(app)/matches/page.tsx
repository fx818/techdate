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
      created_at,
      user1:users!matches_user1_id_fkey(id, name, photo_url),
      user2:users!matches_user2_id_fkey(id, name, photo_url)
    `)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  return (
    <div className="max-w-xl mx-auto px-4 py-7">
      <div className="mb-5">
        <h1 className="font-display text-3xl text-ink leading-none">Matches</h1>
        <p className="text-ink-faint text-sm mt-1.5">People you both said yes to.</p>
      </div>
      {!matches?.length ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">No matches yet</p>
          <p className="text-ink-faint text-sm mt-1">Keep swiping in Discover.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {matches.map((match: any) => {
            const other = match.user1_id === user.id ? match.user2 : match.user1
            return (
              <Link key={match.id} href={`/messages/${match.id}`}
                className="flex items-center gap-3.5 card p-3.5 hover:border-clay transition-colors">
                <div className="w-12 h-12 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep font-display text-lg overflow-hidden shrink-0">
                  {other?.photo_url ? (
                    <img src={other.photo_url} className="w-12 h-12 rounded-full object-cover" alt={other.name} />
                  ) : (
                    other?.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div>
                  <p className="text-ink font-medium">{other?.name}</p>
                  <p className="text-ink-faint text-xs">Tap to chat</p>
                </div>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
