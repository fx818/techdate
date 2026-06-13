import { XpBadge } from '@/components/ui/XpBadge'
import { GENRES } from '@/lib/genres'

interface DatingProfile {
  id: string
  name: string
  photo_url: string | null
  city: string
  genres: string[]
  xp: number
  bio: string | null
}

export function ProfileCard({ profile }: { profile: DatingProfile }) {
  const genreLabels = GENRES.filter(g => profile.genres.includes(g.id)).map(g => g.label)
  const topGenre = genreLabels[0] ?? ''

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden w-full max-w-sm mx-auto">
      <div className="h-64 bg-gray-800 flex items-center justify-center">
        {profile.photo_url ? (
          <img src={profile.photo_url} alt={profile.name} className="w-full h-full object-cover" />
        ) : (
          <div className="text-6xl text-gray-600">{profile.name[0]?.toUpperCase()}</div>
        )}
      </div>
      <div className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <h2 className="text-white text-lg font-semibold">{profile.name}</h2>
          <span className="text-gray-400 text-sm">{profile.city}</span>
        </div>
        <XpBadge xp={profile.xp} />
        {topGenre && (
          <p className="text-indigo-400 text-sm">Most active in: {topGenre}</p>
        )}
        {profile.bio && <p className="text-gray-400 text-sm">{profile.bio}</p>}
        <div className="flex flex-wrap gap-1 pt-1">
          {genreLabels.map(g => (
            <span key={g} className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{g}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
