import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { parseJudgeConfigInput } from '@/lib/admin/judgeConfig'

// POST /api/admin/judge — save the Gideon judge config. Admin-only; the
// gideon_judge_config_save RPC re-checks is_admin() and is the real guard.
export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: isAdmin } = await (supabase as any).rpc('is_admin')
  if (!isAdmin) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const parsed = parseJudgeConfigInput(await request.json().catch(() => null))
  if (!parsed.ok) return NextResponse.json({ error: parsed.error }, { status: 400 })

  const v = parsed.value
  const { data, error } = await (supabase as any).rpc('gideon_judge_config_save', {
    p_enabled: v.enabled,
    p_base_url: v.base_url,
    p_model: v.model,
    p_criteria: v.criteria,
    p_threshold: v.pass_threshold,
    p_api_key: v.api_key,   // '' ⇒ RPC keeps the existing key
  })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ config: data })
}
