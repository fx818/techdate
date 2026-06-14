import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { awardXp } from '@/lib/xp/award'
import type { XpAction } from '@/lib/supabase/types'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { action } = await request.json() as { action: XpAction }
  if (!action) return NextResponse.json({ error: 'Missing action' }, { status: 400 })

  const result = await awardXp(user.id, action)
  return NextResponse.json(result ?? { ok: true })
}
