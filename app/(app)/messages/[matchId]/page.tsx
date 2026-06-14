import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatWindow from '@/components/messages/ChatWindow'
import { ChatHeaderMenu } from '@/components/messages/ChatHeaderMenu'

export default async function MessagesPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify user is part of this match
  const { data: match } = await (supabase as any)
    .from('matches')
    .select('user1_id, user2_id, user1:users!matches_user1_id_fkey(id, name, photo_url), user2:users!matches_user2_id_fkey(id, name, photo_url)')
    .eq('id', matchId)
    .single()

  if (!match || (match.user1_id !== user.id && match.user2_id !== user.id)) {
    redirect('/matches')
  }

  const other = match.user1_id === user.id ? match.user2 : match.user1
  const otherName = other?.name

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-96px)]">
      <div className="flex items-center justify-between mb-3 pb-3 border-b border-line">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep font-display overflow-hidden">
            {other?.photo_url
              ? <img src={other.photo_url} alt={otherName} className="w-9 h-9 object-cover" />
              : otherName?.[0]?.toUpperCase()}
          </div>
          <h1 className="font-display text-xl text-ink">{otherName}</h1>
        </div>
        <ChatHeaderMenu matchId={matchId} otherUserId={other?.id} />
      </div>
      <ChatWindow matchId={matchId} currentUserId={user.id} />
    </div>
  )
}
