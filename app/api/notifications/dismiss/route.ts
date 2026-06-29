import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Dismiss (hide) a single notification by setting dismissed_at on its row.
// RLS restricts the update to the caller's own rows; the explicit user_id
// filter keeps the intent clear and the update tight.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await request.json().catch(() => ({ id: null }))
  if (!id || typeof id !== 'string') {
    return NextResponse.json({ error: 'id required' }, { status: 400 })
  }

  const { error } = await (supabase as any)
    .from('notifications')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ dismissed: true })
}
