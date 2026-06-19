'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function ResolveReportButton({ id, status }: { id: string; status: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const next = status === 'open' ? 'resolved' : 'open'

  async function toggle() {
    setLoading(true)
    const res = await fetch(`/api/admin/reports/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: next }),
    })
    setLoading(false)
    if (res.ok) router.refresh()
  }

  return (
    <button onClick={toggle} disabled={loading}
      className={`btn ${status === 'open' ? 'btn-primary' : 'btn-ghost'} text-sm disabled:opacity-50`}>
      {loading ? '···' : status === 'open' ? 'Mark resolved' : 'Reopen'}
    </button>
  )
}
