import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/feed/BackButton'
import { XpBadge } from '@/components/ui/XpBadge'
import { PostCard } from '@/components/feed/PostCard'
import { UserSafetyMenu } from '@/components/profile/UserSafetyMenu'
import { PingButton } from '@/components/dating/PingButton'
import { GENRES } from '@/lib/genres'
import { activeLabel } from '@/lib/active'

export default async function UserProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')
  if (id === user.id) redirect('/profile')

  const { data: profile } = await (supabase as any)
    .from('users').select('id, name, photo_url, city, genres, xp, bio, last_active, streak_count').eq('id', id).maybeSingle()
  if (!profile) redirect('/feed')

  const { data: blocked } = await (supabase as any).rpc('get_blocked_ids')
  const blockedIds = new Set((blocked ?? []).map((b: any) => b.user_id))
  if (blockedIds.has(id)) {
    return (
      <div className="max-w-xl mx-auto px-4 py-8 space-y-4">
        <BackButton />
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">This user is unavailable</p>
        </div>
      </div>
    )
  }

  const { data: matchCount } = await (supabase as any).rpc('match_count', { p_user: id })

  // Relationship state for the Ping button (connected / they pinged me / I pinged them / none)
  const [a, b] = [user.id, id].sort()
  const [{ data: existingMatch }, { data: mySwipe }, { data: theirSwipe }] = await Promise.all([
    (supabase as any).from('matches').select('id').eq('user1_id', a).eq('user2_id', b).maybeSingle(),
    (supabase as any).from('swipes').select('direction').eq('swiper_id', user.id).eq('swiped_id', id).maybeSingle(),
    (supabase as any).from('swipes').select('direction').eq('swiper_id', id).eq('swiped_id', user.id).eq('direction', 'right').maybeSingle(),
  ])
  let pingState: 'none' | 'pinged' | 'incoming' | 'connected' = 'none'
  if (existingMatch) pingState = 'connected'
  else if (mySwipe?.direction === 'right') pingState = 'pinged'
  else if (theirSwipe) pingState = 'incoming'

  const { count: postCount } = await (supabase as any)
    .from('posts').select('id', { count: 'exact', head: true }).eq('author_id', id).eq('is_gideon', false)

  const { data: posts } = await (supabase as any)
    .from('posts').select('*, users(id, name, photo_url)').eq('author_id', id).eq('is_gideon', false)
    .order('created_at', { ascending: false }).limit(10)

  const postIds = (posts ?? []).map((p: any) => p.id)
  let likedPostIds = new Set<string>(); let bookmarkedPostIds = new Set<string>()
  if (postIds.length > 0) {
    const [{ data: myLikes }, { data: myBookmarks }] = await Promise.all([
      (supabase as any).from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      (supabase as any).from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
    ])
    likedPostIds = new Set((myLikes ?? []).map((l: any) => l.post_id))
    bookmarkedPostIds = new Set((myBookmarks ?? []).map((b: any) => b.post_id))
  }

  const genreLabels = GENRES.filter(g => profile.genres?.includes(g.id)).map(g => g.label)

  return (
    <div className="max-w-xl mx-auto px-4 py-7 space-y-5">
      <BackButton />
      <div className="card p-6 space-y-5">
        <div className="flex items-start gap-4">
          <div className="w-20 h-20 rounded-full bg-clay-tint flex items-center justify-center text-3xl font-display text-clay-deep overflow-hidden shrink-0">
            {profile.photo_url ? <img src={profile.photo_url} className="w-20 h-20 object-cover" alt={profile.name} /> : profile.name?.[0]?.toUpperCase()}
          </div>
          <div className="flex-1 pt-1">
            <div className="flex items-start justify-between">
              <div>
                <h1 className="font-display text-2xl text-ink leading-tight">{profile.name}</h1>
                <p className="text-ink-faint text-sm">{profile.city}</p>
                {activeLabel(profile.last_active) && <p className="text-sage text-xs">{activeLabel(profile.last_active)}</p>}
              </div>
              <UserSafetyMenu userId={id} />
            </div>
            <div className="mt-2"><XpBadge xp={profile.xp} /></div>
          </div>
        </div>
        {profile.bio && <p className="text-ink-soft text-sm leading-relaxed border-t border-line pt-4">{profile.bio}</p>}
        {genreLabels.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {genreLabels.map((g: string) => <span key={g} className="chip">{g}</span>)}
          </div>
        )}
        <div className="border-t border-line pt-4">
          <PingButton otherUserId={id} initialState={pingState} matchId={existingMatch?.id ?? null} />
        </div>
      </div>

      {/* Stat tiles — XP / Chats / Streak / Posts */}
      <div className="grid grid-cols-4 gap-2">
        <div className="card p-3 text-center">
          <p className="font-display text-xl text-ink leading-none">{profile.xp}</p>
          <p className="text-ink-faint text-[11px] mt-1.5">XP</p>
        </div>
        <div className="card p-3 text-center">
          <p className="font-display text-xl text-ink leading-none">{matchCount ?? 0}</p>
          <p className="text-ink-faint text-[11px] mt-1.5">💬 Chats</p>
        </div>
        <div className="card p-3 text-center">
          <p className="font-display text-xl text-ink leading-none">{profile.streak_count ?? 0}</p>
          <p className="text-ink-faint text-[11px] mt-1.5">🔥 Streak</p>
        </div>
        <div className="card p-3 text-center">
          <p className="font-display text-xl text-ink leading-none">{postCount ?? 0}</p>
          <p className="text-ink-faint text-[11px] mt-1.5">📝 Posts</p>
        </div>
      </div>

      <h2 className="font-display text-lg text-ink">Posts</h2>
      {(posts ?? []).length === 0 ? (
        <div className="card p-6 text-center text-ink-faint text-sm">No posts yet.</div>
      ) : (
        <div className="space-y-4">
          {(posts ?? []).map((post: any) => (
            <PostCard key={post.id} post={post} currentUserId={user.id}
              initialLiked={likedPostIds.has(post.id)} initialBookmarked={bookmarkedPostIds.has(post.id)} />
          ))}
        </div>
      )}
    </div>
  )
}
