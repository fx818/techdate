'use client'

import { useRouter } from 'next/navigation'
import { useState, useTransition } from 'react'

// Re-runs the server component (admin_metrics() is recomputed) without a full
// page reload. Server components don't auto-poll, so this is the manual refresh.
export function RefreshButton() {
  const router = useRouter()
  const [isPending, startTransition] = useTransition()
  const [spinning, setSpinning] = useState(false)

  const refresh = () => {
    setSpinning(true)
    startTransition(() => {
      router.refresh()
      // brief spin so the tap registers visually even when refresh is instant
      setTimeout(() => setSpinning(false), 500)
    })
  }

  return (
    <button
      onClick={refresh}
      disabled={isPending}
      className="btn btn-ghost text-sm px-3 py-1.5 shrink-0"
      aria-label="Refresh metrics"
    >
      <span className={spinning ? 'inline-block animate-spin' : 'inline-block'}>↻</span>
      <span className="ml-1.5">Refresh</span>
    </button>
  )
}
