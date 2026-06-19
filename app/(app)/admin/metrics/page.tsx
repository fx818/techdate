import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

// Founder-only kill-test dashboard. All numbers come from the admin_metrics()
// RPC (admin-gated in SQL). The two headline gates mirror the launch memo:
//   • ≥ 20 humans posting unprompted more than once
//   • ≥ 30% of a week-1 cohort still posting in week 4
export default async function AdminMetricsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/feed')

  const { data: m } = await (supabase as any).rpc('admin_metrics')

  if (!m) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-7">
        <p className="text-ink-faint">Metrics unavailable.</p>
      </div>
    )
  }

  const retentionPct = m.cohort_eligible > 0
    ? Math.round((m.cohort_retained / m.cohort_eligible) * 100)
    : 0
  const passRepeat = m.repeat_posters >= 20
  const passRetention = m.cohort_eligible > 0 && retentionPct >= 30

  const Stat = ({ label, value, sub }: { label: string; value: React.ReactNode; sub?: string }) => (
    <div className="card p-4">
      <p className="text-ink-faint text-xs uppercase tracking-widest">{label}</p>
      <p className="font-display text-3xl text-ink mt-1 leading-none">{value}</p>
      {sub && <p className="text-ink-faint text-xs mt-1.5">{sub}</p>}
    </div>
  )

  const Gate = ({ label, pass, detail }: { label: string; pass: boolean; detail: string }) => (
    <div className={`card p-4 border-2 ${pass ? 'border-green-600/40' : 'border-clay/40'}`}>
      <div className="flex items-center justify-between">
        <p className="text-ink font-medium">{label}</p>
        <span className={`text-sm font-semibold ${pass ? 'text-green-700' : 'text-clay-deep'}`}>
          {pass ? '✓ PASS' : '✗ not yet'}
        </span>
      </div>
      <p className="text-ink-faint text-sm mt-1">{detail}</p>
    </div>
  )

  return (
    <div className="max-w-2xl mx-auto px-4 py-7 space-y-6">
      <div>
        <h1 className="font-display text-3xl text-ink leading-none">Kill-test</h1>
        <p className="text-ink-faint text-sm mt-1.5">
          Launch go/no-go. Generated {new Date(m.generated_at).toLocaleString()}.
        </p>
      </div>

      <div className="space-y-3">
        <Gate label="≥ 20 humans posting more than once" pass={passRepeat}
          detail={`${m.repeat_posters} of ${m.posters_total} posters have posted ≥ 2 times.`} />
        <Gate label="≥ 30% of week-1 cohort still posting in week 4" pass={passRetention}
          detail={m.cohort_eligible > 0
            ? `${retentionPct}% — ${m.cohort_retained} of ${m.cohort_eligible} who joined 3–4 weeks ago posted in the last 7 days.`
            : 'No cohort old enough yet (need users who joined 3–4 weeks ago).'} />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        <Stat label="Signups" value={m.signups_total} sub={`+${m.signups_7d} this week`} />
        <Stat label="Active (7d)" value={m.active_7d} />
        <Stat label="Posters" value={m.posters_total} sub={`${m.repeat_posters} repeat`} />
        <Stat label="Community posts" value={m.community_posts_total} sub={`+${m.community_posts_7d} this week`} />
        <Stat label="Pings sent" value={m.pings_total} />
        <Stat label="Connections" value={m.matches_total} />
      </div>
    </div>
  )
}
