import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
export async function POST() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  await (supabase as any).from('users').update({ last_active: new Date().toISOString() }).eq('id', user.id)
  return NextResponse.json({ ok: true })
}
