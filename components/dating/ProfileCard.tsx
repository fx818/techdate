'use client'

import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { XpBadge } from '@/components/ui/XpBadge'
import { GENRES } from '@/lib/genres'
import { DatingProfile } from '@/types/dating'

export function ProfileCard({ profile }: { profile: DatingProfile }) {
  const genreLabels = GENRES.filter(g => profile.genres.includes(g.id)).map(g => g.label)
  const topGenre = genreLabels[0] ?? ''

  const images = (profile.photos && profile.photos.length > 0)
    ? profile.photos
    : (profile.photo_url ? [profile.photo_url] : [])
  const [idx, setIdx] = useState(0)

  return (
    <div className="card overflow-hidden w-full max-w-sm mx-auto animate-pop">
      <div className="relative h-64 bg-clay-tint flex items-center justify-center">
        {images.length === 0 ? (
          <div className="font-display text-7xl text-clay/60">{profile.name[0]?.toUpperCase()}</div>
        ) : (
          <img src={images[idx]} alt={profile.name} className="w-full h-full object-cover" />
        )}
        {images.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => setIdx(i => (i - 1 + images.length) % images.length)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-clay-deep flex items-center justify-center shadow"
              aria-label="Previous photo"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setIdx(i => (i + 1) % images.length)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-clay-deep flex items-center justify-center shadow"
              aria-label="Next photo"
            >
              <ChevronRight size={18} />
            </button>
            <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
              {images.map((_, i) => (
                <span
                  key={i}
                  className={`w-1.5 h-1.5 rounded-full ${i === idx ? 'bg-white' : 'bg-white/50'}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
      <div className="p-5 space-y-2.5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">{profile.name}</h2>
          <span className="text-ink-faint text-sm">{profile.city}</span>
        </div>
        <XpBadge xp={profile.xp} />
        {topGenre && (
          <p className="text-clay-deep text-sm">Most active in: <span className="font-medium">{topGenre}</span></p>
        )}
        {profile.bio && <p className="text-ink-soft text-sm leading-relaxed">{profile.bio}</p>}
        <div className="flex flex-wrap gap-1.5 pt-1">
          {genreLabels.map(g => (
            <span key={g} className="text-xs bg-surface-sunk text-ink-soft px-2 py-0.5 rounded-full">{g}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
