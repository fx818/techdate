import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RequestList } from '@/components/dating/RequestList'

export default async function PingsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const [{ data: received }, { data: sent }] = await Promise.all([
    (supabase as any).rpc('get_incoming_requests'),
    (supabase as any).rpc('get_sent_requests'),
  ])

  return <RequestList received={received ?? []} sent={sent ?? []} />
}
