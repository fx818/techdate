'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Search, MessageSquare } from 'lucide-react'
import { chatHref, userHref } from '@/lib/slug'

type Peer = {
  matchId: string
  id: string
  name: string | null
  username: string | null
  photo_url: string | null
}

export default function PeersList({ peers }: { peers: Peer[] }) {
  const [query, setQuery] = useState('')

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return peers
    return peers.filter(p =>
      (p.name ?? '').toLowerCase().includes(q) ||
      (p.username ?? '').toLowerCase().includes(q)
    )
  }, [peers, query])

  return (
    <div className="space-y-4">
      {/* Search peers */}
      <div className="relative">
        <Search size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none" />
        <input
          type="text"
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Search peers by name or @username"
          className="input pl-10"
          aria-label="Search peers"
        />
      </div>

      {filtered.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">No peers found</p>
          <p className="text-ink-faint text-sm mt-1">No one matches &ldquo;{query}&rdquo;.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {filtered.map(peer => (
            <div key={peer.matchId} className="flex items-center gap-3.5 card p-3.5">
              {/* Tap avatar/name → view their profile */}
              <Link href={userHref(peer.username, peer.id)} className="flex items-center gap-3.5 flex-1 min-w-0 group">
                <div className="w-12 h-12 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep font-display text-lg overflow-hidden shrink-0">
                  {peer.photo_url ? (
                    <img src={peer.photo_url} className="w-12 h-12 rounded-full object-cover" alt={peer.name ?? ''} />
                  ) : (
                    peer.name?.[0]?.toUpperCase()
                  )}
                </div>
                <div className="min-w-0">
                  <p className="text-ink font-medium truncate group-hover:text-clay-deep transition-colors">{peer.name}</p>
                  <p className="text-ink-faint text-xs">View profile</p>
                </div>
              </Link>
              {/* Message button → chat */}
              <Link href={chatHref(peer.username ?? peer.name ?? '', peer.matchId)} aria-label={`Message ${peer.name}`}
                className="w-10 h-10 rounded-full bg-clay-tint text-clay-deep flex items-center justify-center hover:bg-clay hover:text-white transition-colors shrink-0">
                <MessageSquare size={18} />
              </Link>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
