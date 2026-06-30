import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { XpBadge } from '@/components/ui/XpBadge'
import { PostCard } from '@/components/feed/PostCard'
import { GENRES } from '@/lib/genres'
import SignOutButton from '@/components/layout/SignOutButton'
import EditProfile from '@/components/profile/EditProfile'
import { DeleteAccount } from '@/components/profile/DeleteAccount'
import { isPersonalEmail, trialDaysLeft } from '@/lib/auth/email'
import { isDisposableEmail } from '@/lib/auth/disposable'
import { effectiveStreak } from '@/lib/streak'

export default async function ProfilePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('name, username, photo_url, photos, city, genres, xp, bio, preference, streak_count, last_login_date, company_email_verified, created_at, is_admin')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  // Company-email verification status (self-serve verify is offered during the trial).
  const email = user.email ?? ''
  const companyVerified = !!profile.company_email_verified
  const needsVerify = !companyVerified && (isPersonalEmail(email) || isDisposableEmail(email))
  const daysLeft = trialDaysLeft(profile.created_at)

  const { data: matchCount } = await (supabase as any).rpc('match_count', { p_user: user.id })

  // Recent posts (preview 2) + their like/bookmark state
  const { data: myPosts } = await (supabase as any)
    .from('posts').select('*, users(id, name, username, photo_url)').eq('author_id', user.id).eq('is_gideon', false)
    .order('created_at', { ascending: false }).limit(2)
  const myPostIds = (myPosts ?? []).map((p: any) => p.id)
  let likedPostIds = new Set<string>(); let bookmarkedPostIds = new Set<string>()
  if (myPostIds.length > 0) {
    const [{ data: myLikes }, { data: myBookmarks }] = await Promise.all([
      (supabase as any).from('likes').select('post_id').eq('user_id', user.id).in('post_id', myPostIds),
      (supabase as any).from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', myPostIds),
    ])
    likedPostIds = new Set((myLikes ?? []).map((l: any) => l.post_id))
    bookmarkedPostIds = new Set((myBookmarks ?? []).map((b: any) => b.post_id))
  }

  const genreLabels = GENRES.filter(g => profile.genres?.includes(g.id)).map(g => g.label)

  const streak = effectiveStreak(profile.streak_count, profile.last_login_date)

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
                <p className="text-clay-deep text-sm">@{profile.username}</p>
                <p className="text-ink-faint text-sm">{profile.city}</p>
              </div>
              <EditProfile
                userId={user.id}
                initial={{
                  name: profile.name,
                  username: profile.username,
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

      {/* Stat tiles — XP / Peers / Streak */}
      <div className="grid grid-cols-3 gap-2">
        <div className="card p-3 text-center">
          <p className="font-display text-xl text-ink leading-none">{profile.xp}</p>
          <p className="text-ink-faint text-[11px] mt-1.5">XP</p>
        </div>
        <Link href="/matches" className="card p-3 text-center hover:border-clay transition-colors">
          <p className="font-display text-xl text-ink leading-none">{matchCount ?? 0}</p>
          <p className="text-ink-faint text-[11px] mt-1.5">👥 Peers</p>
        </Link>
        <div className="card p-3 text-center">
          <p className="font-display text-xl text-ink leading-none">{streak}</p>
          <p className="text-ink-faint text-[11px] mt-1.5">🔥 Streak</p>
        </div>
      </div>

      {/* Company email verification */}
      {companyVerified ? (
        <div className="card p-4 flex items-center gap-2 text-sage">
          <span className="text-base">✓</span>
          <span className="text-sm font-medium">Company email verified</span>
        </div>
      ) : needsVerify ? (
        <Link href="/verify-company"
          className="card p-4 flex items-center justify-between gap-3 hover:border-clay transition-colors border-clay/40 bg-clay-tint/20">
          <div className="min-w-0">
            <p className="text-ink font-medium">Verify your company email</p>
            <p className="text-ink-faint text-xs mt-0.5">
              {daysLeft > 0
                ? `${daysLeft} day${daysLeft === 1 ? '' : 's'} left in your trial — verify now to keep full access.`
                : 'Required to continue using Await.'}
            </p>
          </div>
          <span className="btn btn-primary text-sm px-3 py-1.5 shrink-0">Verify</span>
        </Link>
      ) : null}

      {/* Interests */}
      <div>
        <h2 className="text-ink-faint text-xs uppercase tracking-widest mb-2.5">Interests</h2>
        <div className="flex flex-wrap gap-2">
          {genreLabels.map((g: string) => (
            <span key={g} className="chip">{g}</span>
          ))}
        </div>
      </div>

      {/* My posts */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <h2 className="text-ink-faint text-xs uppercase tracking-widest">My posts</h2>
          {(myPosts ?? []).length > 0 && (
            <Link href="/profile/posts" className="text-clay-deep text-xs font-medium hover:underline">View all ›</Link>
          )}
        </div>
        {(myPosts ?? []).length === 0 ? (
          <div className="card p-6 text-center text-ink-faint text-sm">You haven&apos;t posted yet.</div>
        ) : (
          <div className="space-y-4">
            {(myPosts ?? []).map((post: any) => (
              <PostCard key={post.id} post={post} currentUserId={user.id}
                initialLiked={likedPostIds.has(post.id)} initialBookmarked={bookmarkedPostIds.has(post.id)} />
            ))}
          </div>
        )}
      </div>

      {/* Saved */}
      <a href="/saved" className="card p-4 flex items-center justify-between hover:border-clay transition-colors">
        <span className="text-ink font-medium flex items-center gap-2">🔖 Saved posts</span>
        <span className="text-ink-faint">›</span>
      </a>

      {/* Admin (founder only) */}
      {profile.is_admin && (
        <div>
          <h2 className="text-ink-faint text-xs uppercase tracking-widest mb-2.5">Admin</h2>
          <div className="space-y-1">
            <Link href="/admin/reports" className="card p-4 flex items-center justify-between hover:border-clay transition-colors">
              <span className="text-ink font-medium flex items-center gap-2">🛡️ Reports</span>
              <span className="text-ink-faint">›</span>
            </Link>
            <Link href="/admin/metrics" className="card p-4 flex items-center justify-between hover:border-clay transition-colors">
              <span className="text-ink font-medium flex items-center gap-2">📊 Metrics</span>
              <span className="text-ink-faint">›</span>
            </Link>
            <Link href="/admin/gideon" className="card p-4 flex items-center justify-between hover:border-clay transition-colors">
              <span className="text-ink font-medium flex items-center gap-2">🤖 Gideon judge</span>
              <span className="text-ink-faint">›</span>
            </Link>
          </div>
        </div>
      )}

      {/* Account */}
      <div className="pt-2 space-y-1">
        <SignOutButton />
        <DeleteAccount />
      </div>
    </div>
  )
}
