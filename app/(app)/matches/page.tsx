import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import PeersList from '@/components/dating/PeersList'

export default async function PeersPage() {
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
      user1:users!matches_user1_id_fkey(id, name, username, photo_url),
      user2:users!matches_user2_id_fkey(id, name, username, photo_url)
    `)
    .or(`user1_id.eq.${user.id},user2_id.eq.${user.id}`)
    .order('created_at', { ascending: false })

  const peers = (matches ?? []).map((match: any) => {
    const other = match.user1_id === user.id ? match.user2 : match.user1
    return {
      matchId: match.id,
      id: other?.id,
      name: other?.name ?? null,
      username: other?.username ?? null,
      photo_url: other?.photo_url ?? null,
    }
  })
  const count = peers.length

  return (
    <div className="max-w-xl mx-auto px-4 py-7">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink leading-none">Peers</h1>
          <p className="text-ink-faint text-sm mt-1.5">People you&apos;re connected with.</p>
        </div>
        <span className="text-sm font-mono text-clay-deep bg-clay-tint px-2.5 py-1 rounded-full">
          {count} {count === 1 ? 'peer' : 'peers'}
        </span>
      </div>
      {count === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">No peers yet</p>
          <p className="text-ink-faint text-sm mt-1">Ping someone from People or their profile to connect.</p>
        </div>
      ) : (
        <PeersList peers={peers} />
      )}
    </div>
  )
}
