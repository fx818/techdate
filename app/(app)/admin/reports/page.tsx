import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ResolveReportButton } from '@/components/admin/ResolveReportButton'

// Founder-only moderation queue. Admin access is gated by users.is_admin (set
// manually in the DB) and enforced by RLS on the reports table; this redirect is
// the UX-level guard so non-admins never see the page.
export default async function AdminReportsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/feed')

  // Admin RLS returns every report; open first, newest first.
  const { data: reports } = await (supabase as any)
    .from('reports')
    .select('id, target_type, target_id, reason, details, status, created_at')
    .order('status', { ascending: true })
    .order('created_at', { ascending: false })
    .limit(200)

  const targetHref = (t: string, id: string) =>
    t === 'post' ? `/posts/${id}` : t === 'user' ? `/users/${id}` : null

  return (
    <div className="max-w-2xl mx-auto px-4 py-7">
      <h1 className="font-display text-3xl text-ink leading-none">Reports</h1>
      <p className="text-ink-faint text-sm mt-1.5 mb-5">Abuse reports across users, posts and comments.</p>

      {(reports ?? []).length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">No reports</p>
          <p className="text-ink-faint text-sm mt-1">Nothing to triage right now.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(reports ?? []).map((r: any) => {
            const href = targetHref(r.target_type, r.target_id)
            return (
              <div key={r.id} className={`card p-4 ${r.status === 'resolved' ? 'opacity-60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="chip">{r.target_type}</span>
                      <span className="text-ink font-medium">{r.reason}</span>
                      {r.status === 'resolved' && <span className="text-ink-faint text-xs">· resolved</span>}
                    </div>
                    {r.details && <p className="text-ink-soft text-sm mt-1.5 break-words">{r.details}</p>}
                    <p className="text-ink-faint text-xs mt-1.5">
                      {new Date(r.created_at).toLocaleString()}
                      {' · '}
                      {href
                        ? <Link href={href} className="text-clay-deep hover:underline">view {r.target_type}</Link>
                        : <span className="font-mono">{r.target_type} {r.target_id.slice(0, 8)}</span>}
                    </p>
                  </div>
                  <ResolveReportButton id={r.id} status={r.status} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
