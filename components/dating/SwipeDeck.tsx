'use client'

import { useState } from 'react'
import { X, Send } from 'lucide-react'
import { ProfileCard } from './ProfileCard'
import { DatingProfile } from '@/types/dating'

export function SwipeDeck({ initialCandidates }: { initialCandidates: DatingProfile[] }) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [loading, setLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [paywallHit, setPaywallHit] = useState(false)
  const [error, setError] = useState('')

  const current = candidates[0]

  async function swipe(direction: 'left' | 'right') {
    if (!current || loading) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/swipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swiped_id: current.id, direction }),
      })

      if (res.status === 429) {
        setPaywallHit(true)
        return
      }

      if (!res.ok) {
        setError('Something went wrong. Please try again.')
        return
      }

      if (direction === 'right') {
        setSent(true)
        setTimeout(() => setSent(false), 1400)
      }
      setCandidates(prev => prev.slice(1))
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (paywallHit) {
    return (
      <div className="card p-8 text-center space-y-4 max-w-sm mx-auto">
        <div className="font-display text-2xl text-ink">That&apos;s 10 for today</div>
        <p className="text-ink-soft text-sm">You&apos;ve used your free pings for today. Check back tomorrow.</p>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="text-center py-16 space-y-1.5">
        <p className="font-display text-xl text-ink">No more people right now.</p>
        <p className="text-ink-faint text-sm">Check back later, or meet people through the discussion feed.</p>
      </div>
    )
  }

  return (
    <div className="space-y-7">
      <ProfileCard profile={current} />

      {sent && <p className="text-clay-deep text-sm text-center animate-rise">✦ Ping sent</p>}
      {error && <p className="text-clay-deep text-sm text-center">{error}</p>}

      <div className="flex justify-center gap-6">
        <button onClick={() => swipe('left')} disabled={loading} aria-label="Skip"
          className="w-16 h-16 rounded-full bg-surface border border-line-strong flex items-center justify-center text-ink-soft shadow-sm hover:border-ink-faint hover:text-ink transition-colors disabled:opacity-50 active:scale-95">
          <X size={26} />
        </button>
        <button onClick={() => swipe('right')} disabled={loading} aria-label="Ping"
          className="w-16 h-16 rounded-full bg-clay border border-clay flex items-center justify-center text-white shadow-md hover:bg-clay-deep transition-colors disabled:opacity-50 active:scale-95">
          <Send size={24} />
        </button>
      </div>
      <p className="text-ink-faint text-xs text-center">Skip · Ping to start a chat</p>
    </div>
  )
}
