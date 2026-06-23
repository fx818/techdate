import { createClient } from '@/lib/supabase/server'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token, platform = 'android' } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  await (supabase as any)
    .from('device_tokens')
    .upsert({ user_id: user.id, token, platform }, { onConflict: 'user_id,token' })

  return NextResponse.json({ registered: true })
}

export async function DELETE(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  await (supabase as any)
    .from('device_tokens')
    .delete()
    .eq('user_id', user.id)
    .eq('token', token)

  return NextResponse.json({ deregistered: true })
}
