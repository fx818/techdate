import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RequestList } from '@/components/dating/RequestList'

export default async function RequestsPage() {
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
      <div className="max-w-md mx-auto px-4 py-16 text-center space-y-4">
        <div className="font-display text-5xl text-clay/70">✦</div>
        <h2 className="font-display text-3xl text-ink">Requests are locked</h2>
        <p className="text-ink-soft">Unlock dating at 100 XP to receive likes. You have <span className="font-mono text-clay-deep">{profile?.xp ?? 0}</span>.</p>
      </div>
    )
  }

  const { data: requests } = await (supabase as any).rpc('get_incoming_requests')

  return (
    <div className="max-w-xl mx-auto px-4 py-7">
      <div className="mb-5">
        <h1 className="font-display text-3xl text-ink leading-none">Requests</h1>
        <p className="text-ink-faint text-sm mt-1.5">People who liked you. Accept to start chatting.</p>
      </div>
      <RequestList initial={requests ?? []} />
    </div>
  )
}
