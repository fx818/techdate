import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: matchId } = await params

  const { data: match } = await (supabase as any)
    .from('matches').select('user1_id, user2_id').eq('id', matchId).maybeSingle()
  if (!match || (match.user1_id !== user.id && match.user2_id !== user.id)) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  await (supabase as any).from('matches').delete().eq('id', matchId)
  return NextResponse.json({ unmatched: true })
}
