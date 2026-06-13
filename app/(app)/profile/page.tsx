import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { XpBadge } from '@/components/ui/XpBadge'
import { GENRES } from '@/lib/genres'
import SignOutButton from '@/components/layout/SignOutButton'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('name, photo_url, city, genres, xp, bio, dating_unlocked')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const genreLabels = GENRES.filter(g => profile.genres?.includes(g.id)).map(g => g.label)

  return (
    <div className="max-w-xl mx-auto px-4 py-6 space-y-6">
      <div className="flex items-start gap-4">
        <div className="w-16 h-16 rounded-full bg-gray-700 flex items-center justify-center text-2xl font-bold text-white">
          {profile.photo_url ? (
            <img src={profile.photo_url} className="w-16 h-16 rounded-full object-cover" alt={profile.name} />
          ) : (
            profile.name?.[0]?.toUpperCase()
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-white text-xl font-semibold">{profile.name}</h1>
          <p className="text-gray-400 text-sm">{profile.city}</p>
          <div className="mt-1">
            <XpBadge xp={profile.xp} />
          </div>
        </div>
      </div>

      {profile.bio && (
        <p className="text-gray-300 text-sm">{profile.bio}</p>
      )}

      <div>
        <h2 className="text-gray-400 text-xs uppercase tracking-wider mb-2">Interests</h2>
        <div className="flex flex-wrap gap-2">
          {genreLabels.map((g: string) => (
            <span key={g} className="bg-gray-800 text-gray-300 text-sm px-3 py-1 rounded-full">{g}</span>
          ))}
        </div>
      </div>

      <div className="border-t border-gray-800 pt-4">
        <div className="flex justify-between text-sm text-gray-400 mb-2">
          <span>Dating unlocked</span>
          <span>{profile.dating_unlocked ? '✓ Yes' : `No — need ${Math.max(0, 100 - profile.xp)} more XP`}</span>
        </div>
      </div>

      <SignOutButton />
    </div>
  )
}
