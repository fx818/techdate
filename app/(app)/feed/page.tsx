import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PostCard } from '@/components/feed/PostCard'
import { CreatePost } from '@/components/feed/CreatePost'
import { FeedFilters } from '@/components/feed/FeedFilters'

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; genre?: string; source?: string; sort?: string }>
}) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('genres, xp, dating_unlocked')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre = sp.genre ?? 'all'
  const source = sp.source ?? 'all'
  const sort = sp.sort ?? 'latest'

  let query = (supabase as any)
    .from('posts')
    .select('*, users(id, name, photo_url)')

  // Genre: a specific topic, or fall back to the user's chosen genres
  if (genre !== 'all') query = query.eq('genre', genre)
  else query = query.in('genre', profile.genres)

  // Source: community posts vs Gideon-curated
  if (source === 'gideon') query = query.eq('is_gideon', true)
  else if (source === 'community') query = query.eq('is_gideon', false)

  // Search title + content (sanitise chars that would break the PostgREST filter)
  if (q) {
    const safe = q.replace(/[,()*%:]/g, ' ').trim()
    if (safe) query = query.or(`title.ilike.%${safe}%,content.ilike.%${safe}%`)
  }

  // Sort
  const orderCol = sort === 'top' ? 'likes_count' : sort === 'discussed' ? 'comments_count' : 'created_at'
  query = query.order(orderCol, { ascending: false }).limit(30)

  const { data: posts } = await query

  // Which of these posts has the current user already liked?
  const postIds = (posts ?? []).map((p: any) => p.id)
  let likedPostIds = new Set<string>()
  if (postIds.length > 0) {
    const { data: myLikes } = await (supabase as any)
      .from('likes')
      .select('post_id')
      .eq('user_id', user.id)
      .in('post_id', postIds)
    likedPostIds = new Set((myLikes ?? []).map((l: any) => l.post_id))
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-7 space-y-5">
      <div>
        <h1 className="font-display text-3xl text-ink leading-none">Feed</h1>
        <p className="text-ink-faint text-sm mt-1.5">What the community is building.</p>
      </div>

      <CreatePost userGenres={profile.genres} />

      {!profile.dating_unlocked && (
        <div className="rounded-xl bg-sage-tint border border-sage/20 p-3.5 text-sm text-sage flex items-center gap-2">
          <span className="font-display text-base">✦</span>
          Earn <span className="font-semibold">{100 - profile.xp}</span> more XP to unlock dating.
        </div>
      )}

      <FeedFilters userGenres={profile.genres} />

      <div className="space-y-4">
        {(posts ?? []).length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-display text-xl text-ink">{q ? 'No posts match your search' : 'Nothing here yet'}</p>
            <p className="text-ink-faint text-sm mt-1">
              {q || genre !== 'all' || source !== 'all' ? 'Try clearing some filters.' : 'Be the first to post something.'}
            </p>
          </div>
        ) : (
          (posts ?? []).map((post: any) => (
            <PostCard key={post.id} post={post} currentUserId={user.id} initialLiked={likedPostIds.has(post.id)} />
          ))
        )}
      </div>
    </div>
  )
}
