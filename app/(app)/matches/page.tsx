import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { MessageSquare } from 'lucide-react'
import { chatHref, userHref } from '@/lib/slug'

export default async function ChatsPage() {
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

  const count = matches?.length ?? 0

  return (
    <div className="max-w-xl mx-auto px-4 py-7">
      <div className="mb-5 flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink leading-none">Chats</h1>
          <p className="text-ink-faint text-sm mt-1.5">People you&apos;re connected with.</p>
        </div>
        <span className="text-sm font-mono text-clay-deep bg-clay-tint px-2.5 py-1 rounded-full">
          {count} {count === 1 ? 'chat' : 'chats'}
        </span>
      </div>
      {count === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">No chats yet</p>
          <p className="text-ink-faint text-sm mt-1">Ping someone from People or their profile to start one.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {matches.map((match: any) => {
            const other = match.user1_id === user.id ? match.user2 : match.user1
            return (
              <div key={match.id} className="flex items-center gap-3.5 card p-3.5">
                {/* Tap avatar/name → view their profile */}
                <Link href={userHref(other?.username, other?.id)} className="flex items-center gap-3.5 flex-1 min-w-0 group">
                  <div className="w-12 h-12 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep font-display text-lg overflow-hidden shrink-0">
                    {other?.photo_url ? (
                      <img src={other.photo_url} className="w-12 h-12 rounded-full object-cover" alt={other.name} />
                    ) : (
                      other?.name?.[0]?.toUpperCase()
                    )}
                  </div>
                  <div className="min-w-0">
                    <p className="text-ink font-medium truncate group-hover:text-clay-deep transition-colors">{other?.name}</p>
                    <p className="text-ink-faint text-xs">View profile</p>
                  </div>
                </Link>
                {/* Message button → chat */}
                <Link href={chatHref(other?.username ?? other?.name ?? '', match.id)} aria-label={`Message ${other?.name}`}
                  className="w-10 h-10 rounded-full bg-clay-tint text-clay-deep flex items-center justify-center hover:bg-clay hover:text-white transition-colors shrink-0">
                  <MessageSquare size={18} />
                </Link>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
