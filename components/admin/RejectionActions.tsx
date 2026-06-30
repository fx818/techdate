'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

// Approve (promote into the feed) / Delete (permanent tombstone) for one reject.
export function RejectionActions({ id }: { id: string }) {
  const router = useRouter()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)

  const act = async (action: 'approve' | 'delete') => {
    if (action === 'delete' && !confirm('Delete permanently? This URL will never be seeded again.')) return
    setBusy(true); setErr(null)
    try {
      const res = await fetch(`/api/admin/gideon/rejections/${id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      })
      if (!res.ok) { setErr((await res.json()).error || 'Failed'); return }
      router.refresh()
    } catch {
      setErr('Failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      {err && <span className="text-clay-deep text-xs">{err}</span>}
      <button onClick={() => act('approve')} disabled={busy}
        className="btn btn-primary text-sm px-3 py-1.5">Approve</button>
      <button onClick={() => act('delete')} disabled={busy}
        className="btn btn-ghost text-sm px-3 py-1.5">Delete</button>
    </div>
  )
}
