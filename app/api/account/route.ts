import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function DELETE() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { error } = await (supabase as any).rpc('delete_own_account')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  await supabase.auth.signOut()
  return NextResponse.json({ ok: true })
}
