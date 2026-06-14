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

type Tab = 'all' | 'received' | 'sent'

export function RequestList({ received, sent }: { received: RequestProfile[]; sent: RequestProfile[] }) {
  const router = useRouter()
  const [tab, setTab] = useState<Tab>('all')
  const [recv, setRecv] = useState(received)
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
      setRecv(prev => prev.filter(r => r.id !== requesterId))
      if (action === 'accept' && data.matchId) {
        router.push(`/messages/${data.matchId}`)
      }
    } finally {
      setBusy(null)
    }
  }

  const TABS: { key: Tab; label: string; count: number }[] = [
    { key: 'all', label: 'All', count: recv.length + sent.length },
    { key: 'received', label: 'Received', count: recv.length },
    { key: 'sent', label: 'Sent', count: sent.length },
  ]

  const items: (RequestProfile & { kind: 'received' | 'sent' })[] = [
    ...(tab === 'all' || tab === 'received' ? recv.map(r => ({ ...r, kind: 'received' as const })) : []),
    ...(tab === 'all' || tab === 'sent' ? sent.map(s => ({ ...s, kind: 'sent' as const })) : []),
  ]

  return (
    <div className="space-y-5">
      {/* Tabs */}
      <div className="flex gap-1 p-1 rounded-xl bg-surface-sunk border border-line">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 py-1.5 text-sm rounded-lg transition-colors ${tab === t.key ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'}`}>
            {t.label}{t.count > 0 && <span className="ml-1 text-xs opacity-70">{t.count}</span>}
          </button>
        ))}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">
            {tab === 'sent' ? 'No sent requests' : tab === 'received' ? 'No requests received' : 'Nothing here yet'}
          </p>
          <p className="text-ink-faint text-sm mt-1">
            {tab === 'sent' ? 'Like someone in Discover to send a request.' : 'When someone likes you, they’ll appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {items.map(p => {
            const genreLabels = GENRES.filter(g => p.genres?.includes(g.id)).map(g => g.label)
            return (
              <div key={`${p.kind}-${p.id}`} className="card overflow-hidden animate-rise">
                <div className="h-44 bg-clay-tint flex items-center justify-center relative">
                  {p.photo_url
                    ? <img src={p.photo_url} alt={p.name} className="w-full h-full object-cover" />
                    : <span className="font-display text-6xl text-clay/60">{p.name[0]?.toUpperCase()}</span>}
                  <span className={`absolute top-3 right-3 text-xs px-2 py-0.5 rounded-full font-medium ${
                    p.kind === 'received' ? 'bg-clay text-white' : 'bg-surface/90 text-ink-soft border border-line'
                  }`}>
                    {p.kind === 'received' ? 'Likes you' : 'Sent'}
                  </span>
                </div>
                <div className="p-5 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-2xl text-ink">{p.name}</h3>
                    <span className="text-ink-faint text-sm">{p.city}</span>
                  </div>
                  <XpBadge xp={p.xp} />
                  {p.bio && <p className="text-ink-soft text-sm leading-relaxed">{p.bio}</p>}
                  {genreLabels.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 pt-1">
                      {genreLabels.map(g => (
                        <span key={g} className="text-xs bg-surface-sunk text-ink-soft px-2 py-0.5 rounded-full">{g}</span>
                      ))}
                    </div>
                  )}
                  {p.kind === 'received' ? (
                    <div className="flex gap-2 pt-2">
                      <button onClick={() => respond(p.id, 'decline')} disabled={busy === p.id}
                        className="btn btn-ghost flex-1">Decline</button>
                      <button onClick={() => respond(p.id, 'accept')} disabled={busy === p.id}
                        className="btn btn-primary flex-1">{busy === p.id ? '···' : 'Accept & chat'}</button>
                    </div>
                  ) : (
                    <p className="text-ink-faint text-sm pt-1">✦ Request sent · waiting for a response</p>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
