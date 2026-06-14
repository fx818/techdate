import { XpBadge } from '@/components/ui/XpBadge'
import { GENRES } from '@/lib/genres'
import { DatingProfile } from '@/types/dating'

export function ProfileCard({ profile }: { profile: DatingProfile }) {
  const genreLabels = GENRES.filter(g => profile.genres.includes(g.id)).map(g => g.label)
  const topGenre = genreLabels[0] ?? ''

  return (
    <div className="card overflow-hidden w-full max-w-sm mx-auto animate-pop">
      <div className="h-64 bg-clay-tint flex items-center justify-center">
        {profile.photo_url ? (
          <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover" />
        ) : (
          <div className="font-display text-7xl text-clay/60">{profile.name[0]?.toUpperCase()}</div>
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
