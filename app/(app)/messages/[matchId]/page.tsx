import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import ChatWindow from '@/components/messages/ChatWindow'

export default async function MessagesPage({ params }: { params: Promise<{ matchId: string }> }) {
  const { matchId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Verify user is part of this match
  const { data: match } = await (supabase as any)
    .from('matches')
    .select('user1_id, user2_id, user1:users!matches_user1_id_fkey(name), user2:users!matches_user2_id_fkey(name)')
    .eq('id', matchId)
    .single()

  if (!match || (match.user1_id !== user.id && match.user2_id !== user.id)) {
    redirect('/matches')
  }

  const otherName = match.user1_id === user.id ? match.user2?.name : match.user1?.name

  return (
    <div className="max-w-xl mx-auto px-4 py-6 flex flex-col h-[calc(100vh-80px)]">
      <div className="flex items-center gap-2 mb-4">
        <h1 className="text-white font-semibold">{otherName}</h1>
      </div>
      <ChatWindow matchId={matchId} currentUserId={user.id} />
    </div>
  )
}
