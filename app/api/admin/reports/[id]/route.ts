import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// PATCH /api/admin/reports/[id] — flip a report's status (open <-> resolved).
// Admin-only; RLS ("Admins can update reports") is the real guard, the is_admin()
// check just gives a clean 403 instead of a silent no-op.
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: isAdmin } = await (supabase as any).rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { id } = await params
  const { status } = await request.json() as { status: string }
  if (status !== 'open' && status !== 'resolved') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await (supabase as any).from('reports').update({ status }).eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
