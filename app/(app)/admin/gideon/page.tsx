import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { JudgeConfigForm } from '@/components/admin/JudgeConfigForm'

// Founder-only. Edits the gideon_judge_config singleton through admin RPCs.
// The raw API key is never sent to the browser — only key_set + key_last4.
export default async function AdminGideonPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/feed')

  const { data: config } = await (supabase as any).rpc('gideon_judge_config_get')

  if (!config) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-7">
        <p className="text-ink-faint">Judge config unavailable.</p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-7 space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink leading-none">Gideon judge</h1>
        <p className="text-ink-faint text-sm mt-1.5">
          LLM quality gate for seeded posts. Defaults to Gemini. When off, Gideon inserts
          the ranked top picks unfiltered.
        </p>
      </div>
      <JudgeConfigForm initial={config} />
    </div>
  )
}
