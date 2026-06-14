'use client'

import { useRouter } from 'next/navigation'
import { ChevronLeft } from 'lucide-react'

// Returns to the previous page (feed, notifications, saved, …) instead of a
// fixed destination. Falls back to /feed when there's no history to go back to.
export function BackButton() {
  const router = useRouter()
  return (
    <button
      onClick={() => { if (window.history.length > 1) router.back(); else router.push('/feed') }}
      className="inline-flex items-center gap-1 text-ink-faint hover:text-ink text-sm">
      <ChevronLeft size={16} /> Back
    </button>
  )
}
