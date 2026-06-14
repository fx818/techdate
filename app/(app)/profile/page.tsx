import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { XpBadge } from '@/components/ui/XpBadge'
import { GENRES } from '@/lib/genres'
import SignOutButton from '@/components/layout/SignOutButton'
import EditProfile from '@/components/profile/EditProfile'
import { DeleteAccount } from '@/components/profile/DeleteAccount'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('name, photo_url, photos, city, genres, xp, bio, dating_unlocked, preference, streak_count')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const genreLabels = GENRES.filter(g => profile.genres?.includes(g.id)).map(g => g.label)

  const streak = profile.streak_count ?? 0
  const xpToUnlock = Math.max(0, 100 - profile.xp)

  return (
    <div className="max-w-xl mx-auto px-4 py-7 space-y-5">
      {/* Identity */}
      <div className="card p-6 space-y-4">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-clay-tint flex items-center justify-center text-3xl font-display text-clay-deep overflow-hidden shrink-0">
            {profile.photo_url ? (
              <img src={profile.photo_url} className="w-20 h-20 rounded-full object-cover" alt={profile.name} />
            ) : (
              profile.name?.[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 pt-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h1 className="font-display text-2xl text-ink leading-tight truncate">{profile.name}</h1>
                <p className="text-ink-faint text-sm">{profile.city}</p>
              </div>
              <EditProfile
                userId={user.id}
                initial={{
                  name: profile.name,
                  bio: profile.bio,
                  city: profile.city,
                  genres: profile.genres ?? [],
                  preference: profile.preference,
                  photo_url: profile.photo_url,
                  photos: profile.photos ?? [],
                }}
              />
            </div>
            <div className="mt-2"><XpBadge xp={profile.xp} /></div>
          </div>
        </div>
        {profile.bio && (
          <p className="text-ink-soft text-sm leading-relaxed border-t border-line pt-4">{profile.bio}</p>
        )}
      </div>

      {/* Stat tiles */}
      <div className="grid grid-cols-3 gap-3">
        <div className="card p-4 text-center">
          <p className="font-display text-2xl text-ink leading-none">{profile.xp}</p>
          <p className="text-ink-faint text-xs mt-1.5">XP</p>
        </div>
        <div className="card p-4 text-center">
          <p className="font-display text-2xl text-ink leading-none">{streak}</p>
          <p className="text-ink-faint text-xs mt-1.5">🔥 day streak</p>
        </div>
        <div className="card p-4 text-center">
          <p className={`font-display text-2xl leading-none ${profile.dating_unlocked ? 'text-sage' : 'text-ink-faint'}`}>
            {profile.dating_unlocked ? '✓' : '🔒'}
          </p>
          <p className="text-ink-faint text-xs mt-1.5">{profile.dating_unlocked ? 'Dating on' : `${xpToUnlock} XP left`}</p>
        </div>
      </div>

      {/* Interests */}
      <div>
        <h2 className="text-ink-faint text-xs uppercase tracking-widest mb-2.5">Interests</h2>
        <div className="flex flex-wrap gap-2">
          {genreLabels.map((g: string) => (
            <span key={g} className="chip">{g}</span>
          ))}
        </div>
      </div>

      {/* Saved */}
      <a href="/saved" className="card p-4 flex items-center justify-between hover:border-clay transition-colors">
        <span className="text-ink font-medium flex items-center gap-2">🔖 Saved posts</span>
        <span className="text-ink-faint">›</span>
      </a>

      {/* Account */}
      <div className="pt-2 space-y-1">
        <SignOutButton />
        <DeleteAccount />
      </div>
    </div>
  )
}
