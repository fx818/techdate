import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const VALID_TYPES = ['user', 'post', 'comment']

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { target_type, target_id, reason, details } = await request.json() as
    { target_type: string; target_id: string; reason: string; details?: string }

  if (!VALID_TYPES.includes(target_type) || !target_id || !reason) {
    return NextResponse.json({ error: 'Bad request' }, { status: 400 })
  }

  const { error } = await (supabase as any).from('reports').insert({
    reporter_id: user.id, target_type, target_id, reason, details: details ?? null,
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ reported: true })
}
