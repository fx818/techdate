import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseRejectionAction } from '@/lib/admin/rejectionAction'

// POST /api/admin/gideon/rejections/[id] — { action: 'approve' | 'delete' }.
// Admin-only; the RPCs re-check is_admin() and are the real guard.
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: isAdmin } = await (supabase as any).rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseRejectionAction(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const { id } = await params
  const fn = parsed.action === 'approve' ? 'gideon_approve_rejection' : 'gideon_dismiss_rejection'
  const { error } = await (supabase as any).rpc(fn, { p_id: id })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
