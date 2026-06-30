import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RejectionActions } from '@/components/admin/RejectionActions'

// Founder-only. The judge's rejected candidates (migration 032). Approve
// promotes into the feed; Delete tombstones the URL permanently.
export default async function AdminRejectionsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users').select('is_admin').eq('id', user.id).single()
  if (!profile?.is_admin) redirect('/feed')

  const { data: rejects } = await (supabase as any)
    .from('gideon_rejections')
    .select('id, title, url, genre, source, score, reason, created_at')
    .order('created_at', { ascending: false })
    .limit(200)

  return (
    <div className="max-w-2xl mx-auto px-4 py-7">
      <h1 className="font-display text-3xl text-ink leading-none">Rejected by Gideon</h1>
      <p className="text-ink-faint text-sm mt-1.5 mb-5">
        Posts the judge dropped. Approve to publish, or delete permanently.
      </p>

      {(rejects ?? []).length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">Queue clear</p>
          <p className="text-ink-faint text-sm mt-1">Nothing rejected to review.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {(rejects ?? []).map((r: any) => (
            <div key={r.id} className="card p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="chip">{r.genre}</span>
                    <span className="chip">{r.source}</span>
                    <span className="text-clay-deep text-sm font-semibold">score {r.score}</span>
                  </div>
                  <a href={r.url} target="_blank" rel="noopener noreferrer"
                    className="text-ink font-medium hover:underline block mt-1.5 break-words">{r.title}</a>
                  {r.reason && <p className="text-ink-soft text-sm mt-1 break-words">{r.reason}</p>}
                  <p className="text-ink-faint text-xs mt-1.5">{new Date(r.created_at).toLocaleString()}</p>
                </div>
                <RejectionActions id={r.id} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
