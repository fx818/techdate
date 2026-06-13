'use client'

import { useState } from 'react'
import { X, Heart } from 'lucide-react'
import { ProfileCard } from './ProfileCard'
import { MatchModal } from './MatchModal'
import { DatingProfile } from '@/types/dating'

export function SwipeDeck({ initialCandidates }: { initialCandidates: DatingProfile[] }) {
  const [candidates, setCandidates] = useState(initialCandidates)
  const [loading, setLoading] = useState(false)
  const [match, setMatch] = useState<{ id: string; name: string } | null>(null)
  const [paywallHit, setPaywallHit] = useState(false)

  const current = candidates[0]

  async function swipe(direction: 'left' | 'right') {
    if (!current || loading) return
    setLoading(true)

    const res = await fetch('/api/swipes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ swiped_id: current.id, direction }),
    })

    const data = await res.json()

    if (res.status === 429) {
      setPaywallHit(true)
      setLoading(false)
      return
    }

    if (data.match) {
      setMatch({ id: data.matchId, name: current.name })
    }

    setCandidates(prev => prev.slice(1))
    setLoading(false)
  }

  if (paywallHit) {
    return (
      <div className="text-center space-y-4 py-12">
        <p className="text-white text-lg font-semibold">You&apos;ve used your 10 free swipes today</p>
        <p className="text-gray-400 text-sm">Upgrade to Premium for unlimited swipes</p>
        <button className="bg-indigo-600 text-white px-6 py-2 rounded-lg">Upgrade — ₹299/mo</button>
      </div>
    )
  }

  if (!current) {
    return (
      <div className="text-center py-12 text-gray-400">
        <p>No more profiles right now.</p>
        <p className="text-sm mt-1">Check back tomorrow or be more active in discussions!</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {match && (
        <MatchModal matchId={match.id} matchName={match.name} onClose={() => setMatch(null)} />
      )}

      <ProfileCard profile={current} />

      <div className="flex justify-center gap-8">
        <button onClick={() => swipe('left')} disabled={loading}
          className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-red-400 hover:bg-red-950 disabled:opacity-50">
          <X size={24} />
        </button>
        <button onClick={() => swipe('right')} disabled={loading}
          className="w-14 h-14 rounded-full bg-gray-800 border border-gray-700 flex items-center justify-center text-green-400 hover:bg-green-950 disabled:opacity-50">
          <Heart size={24} />
        </button>
      </div>
    </div>
  )
}
