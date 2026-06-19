'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { X, PenLine, Users } from 'lucide-react'

const DISMISS_KEY = 'await:getting-started-dismissed'

// First-run nudge: pushes a brand-new user toward their first contribution
// (post or ping) — retention starts in the first session. Shows only for
// low-activity users (xp below one post's worth) and can be dismissed.
export function GettingStarted({ xp }: { xp: number }) {
  const [show, setShow] = useState(false)

  // localStorage is only available post-hydration, so the decision to show must
  // happen in an effect (not in initial state, which also runs during SSR).
  useEffect(() => {
    if (xp >= 25) return
    if (localStorage.getItem(DISMISS_KEY)) return
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setShow(true)
  }, [xp])

  if (!show) return null

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setShow(false)
  }

  return (
    <div className="card p-5 relative animate-rise">
      <button onClick={dismiss} aria-label="Dismiss"
        className="absolute top-3 right-3 text-ink-faint hover:text-ink">
        <X size={16} />
      </button>
      <p className="font-display text-xl text-ink">Welcome to Await</p>
      <p className="text-ink-soft text-sm mt-1">
        The community comes alive when you jump in. Start with one of these:
      </p>
      <div className="flex flex-wrap gap-2 mt-3">
        <button
          onClick={() => window.dispatchEvent(new Event('await:new-post'))}
          className="btn btn-primary text-sm inline-flex items-center gap-1.5">
          <PenLine size={15} /> Write your first post
        </button>
        <Link href="/discover" className="btn btn-ghost text-sm inline-flex items-center gap-1.5">
          <Users size={15} /> Find your people
        </Link>
      </div>
    </div>
  )
}
