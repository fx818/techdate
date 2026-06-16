'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { Eye, Trash2 } from 'lucide-react'
import { timeAgo } from '@/lib/time'

type Item = {
  id: string
  slug: string | null
  title: string
  created_at: string
  authorName: string
  authorPhoto: string | null
  isNew: boolean
}

// Width (px) the card slides left to reveal the View + Delete actions.
const REVEAL = 128

export default function NotificationsList({ items }: { items: Item[] }) {
  const [list, setList] = useState(items)

  async function dismiss(id: string) {
    // Optimistic: drop it from the list right away, then persist.
    setList(prev => prev.filter(i => i.id !== id))
    try {
      await fetch('/api/notifications/dismiss', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ postId: id }),
      })
    } catch {
      /* best-effort; it'll reappear on next load if the write failed */
    }
  }

  if (list.length === 0) {
    return (
      <div className="card p-8 text-center">
        <p className="font-display text-xl text-ink">All caught up</p>
        <p className="text-ink-faint text-sm mt-1">You&apos;ve cleared your notifications.</p>
      </div>
    )
  }

  return (
    <div className="space-y-2.5">
      {list.map(n => (
        <NotificationRow key={n.id} n={n} onDelete={() => dismiss(n.id)} />
      ))}
    </div>
  )
}

function NotificationRow({ n, onDelete }: { n: Item; onDelete: () => void }) {
  const [revealed, setRevealed] = useState(false)
  const [drag, setDrag] = useState(0)
  const startX = useRef(0)
  const moved = useRef(false)

  const base = revealed ? -REVEAL : 0
  const offset = Math.max(-REVEAL, Math.min(0, base + drag))

  function onTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX
    moved.current = false
  }
  function onTouchMove(e: React.TouchEvent) {
    const delta = e.touches[0].clientX - startX.current
    if (Math.abs(delta) > 6) moved.current = true
    setDrag(delta)
  }
  function onTouchEnd() {
    // Snap open if dragged past the halfway point, else closed.
    setRevealed(offset < -REVEAL / 2)
    setDrag(0)
  }

  // Tap toggles the action panel (the desktop "2nd way"); a real swipe is not a tap.
  function onClick() {
    if (moved.current) { moved.current = false; return }
    setRevealed(r => !r)
  }

  const href = `/posts/${n.slug ?? n.id}`

  return (
    <div className="relative overflow-hidden rounded-2xl">
      {/* Action panel behind the card, revealed on the right */}
      <div className="absolute inset-y-0 right-0 flex">
        <Link
          href={href}
          aria-label="View"
          className="w-16 flex flex-col items-center justify-center gap-1 bg-clay-tint text-clay-deep text-xs"
        >
          <Eye size={18} />
          View
        </Link>
        <button
          type="button"
          onClick={onDelete}
          aria-label="Delete notification"
          className="w-16 flex flex-col items-center justify-center gap-1 bg-clay text-white text-xs"
        >
          <Trash2 size={18} />
          Delete
        </button>
      </div>

      {/* Sliding content */}
      <div
        role="button"
        tabIndex={0}
        onClick={onClick}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setRevealed(r => !r) } }}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
        style={{ transform: `translateX(${offset}px)`, transition: drag ? 'none' : 'transform 0.2s ease' }}
        className={`relative flex items-center gap-3 card p-3.5 cursor-pointer select-none ${
          n.isNew ? 'border-clay/40 bg-clay-tint/30' : ''
        }`}
      >
        <div className="w-10 h-10 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep font-display overflow-hidden shrink-0">
          {n.authorPhoto
            ? <img src={n.authorPhoto} alt={n.authorName} className="w-10 h-10 object-cover" />
            : n.authorName[0]?.toUpperCase()}
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm text-ink">
            <span className="font-medium">{n.authorName}</span> posted
          </p>
          <p className="text-ink-soft text-sm truncate">{n.title}</p>
        </div>
        <div className="flex flex-col items-end gap-1 shrink-0">
          <span className="text-ink-faint text-xs">{timeAgo(n.created_at)}</span>
          {n.isNew && <span className="w-2 h-2 rounded-full bg-clay" />}
        </div>
      </div>
    </div>
  )
}
