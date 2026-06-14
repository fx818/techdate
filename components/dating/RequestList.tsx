'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { XpBadge } from '@/components/ui/XpBadge'
import { GENRES } from '@/lib/genres'

interface RequestProfile {
  id: string
  name: string
  photo_url: string | null
  city: string
  xp: number
  bio: string | null
  genres: string[]
}

export function RequestList({ initial }: { initial: RequestProfile[] }) {
  const router = useRouter()
  const [requests, setRequests] = useState(initial)
  const [busy, setBusy] = useState<string | null>(null)

  async function respond(requesterId: string, action: 'accept' | 'decline') {
    setBusy(requesterId)
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id: requesterId, action }),
      })
      const data = await res.json()
      setRequests(prev => prev.filter(r => r.id !== requesterId))
      if (action === 'accept' && data.matchId) {
        router.push(`/messages/${data.matchId}`)
      }
    } finally {
      setBusy(null)
    }
  }

  if (requests.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-xl text-ink">No requests right now</p>
        <p className="text-ink-faint text-sm mt-1">When someone likes you, they&apos;ll appear here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {requests.map(r => {
        const genreLabels = GENRES.filter(g => r.genres?.includes(g.id)).map(g => g.label)
        return (
          <div key={r.id} className="card overflow-hidden animate-rise">
            <div className="h-44 bg-clay-tint flex items-center justify-center">
              {r.photo_url
                ? <img src={r.photo_url} alt={r.name} className="w-full h-full object-cover" />
                : <span className="font-display text-6xl text-clay/60">{r.name[0]?.toUpperCase()}</span>}
            </div>
            <div className="p-5 space-y-2.5">
              <div className="flex items-center justify-between">
                <h3 className="font-display text-2xl text-ink">{r.name}</h3>
                <span className="text-ink-faint text-sm">{r.city}</span>
              </div>
              <XpBadge xp={r.xp} />
              {r.bio && <p className="text-ink-soft text-sm leading-relaxed">{r.bio}</p>}
              {genreLabels.length > 0 && (
                <div className="flex flex-wrap gap-1.5 pt-1">
                  {genreLabels.map(g => (
                    <span key={g} className="text-xs bg-surface-sunk text-ink-soft px-2 py-0.5 rounded-full">{g}</span>
                  ))}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button onClick={() => respond(r.id, 'decline')} disabled={busy === r.id}
                  className="btn btn-ghost flex-1">
                  Decline
                </button>
                <button onClick={() => respond(r.id, 'accept')} disabled={busy === r.id}
                  className="btn btn-primary flex-1">
                  {busy === r.id ? '···' : 'Accept & chat'}
                </button>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
