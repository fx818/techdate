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
    .select('name, photo_url, city, genres, xp, bio, dating_unlocked, preference, streak_count')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const genreLabels = GENRES.filter(g => profile.genres?.includes(g.id)).map(g => g.label)

  return (
    <div className="max-w-xl mx-auto px-4 py-7 space-y-6">
      <div className="card p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-clay-tint flex items-center justify-center text-3xl font-display text-clay-deep overflow-hidden shrink-0">
            {profile.photo_url ? (
              <img src={profile.photo_url} className="w-20 h-20 rounded-full object-cover" alt={profile.name} />
            ) : (
              profile.name?.[0]?.toUpperCase()
            )}
          </div>
          <div className="flex-1 pt-1">
            <h1 className="font-display text-2xl text-ink leading-tight">{profile.name}</h1>
            <p className="text-ink-faint text-sm">{profile.city}</p>
            <div className="mt-2">
              <XpBadge xp={profile.xp} />
            </div>
          </div>
        </div>

        {profile.bio && (
          <p className="text-ink-soft text-sm leading-relaxed border-t border-line pt-4">{profile.bio}</p>
        )}
      </div>

      <div>
        <h2 className="text-ink-faint text-xs uppercase tracking-widest mb-2.5">Interests</h2>
        <div className="flex flex-wrap gap-2">
          {genreLabels.map((g: string) => (
            <span key={g} className="chip">{g}</span>
          ))}
        </div>
      </div>

      <div className="card divide-y divide-line">
        <div className="flex justify-between items-center text-sm p-4">
          <span className="text-ink-soft">Dating</span>
          <span className={profile.dating_unlocked ? 'text-sage font-medium' : 'text-ink-faint'}>
            {profile.dating_unlocked ? '✓ Unlocked' : `${Math.max(0, 100 - profile.xp)} XP to unlock`}
          </span>
        </div>
        <div className="flex justify-between items-center text-sm p-4">
          <span className="text-ink-soft">Login streak</span>
          <span className="text-clay-deep font-medium">
            🔥 <span className="font-mono">{profile.streak_count ?? 0}</span> day{(profile.streak_count ?? 0) === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      <a href="/saved" className="card p-4 flex items-center justify-between hover:border-clay transition-colors">
        <span className="text-ink font-medium flex items-center gap-2">🔖 Saved posts</span>
        <span className="text-ink-faint">›</span>
      </a>

      <EditProfile
        userId={user.id}
        initial={{
          name: profile.name,
          bio: profile.bio,
          city: profile.city,
          genres: profile.genres ?? [],
          preference: profile.preference,
          photo_url: profile.photo_url,
        }}
      />
      <SignOutButton />
      <DeleteAccount />
    </div>
  )
}
