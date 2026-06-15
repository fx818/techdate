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

  // Independent reads in parallel (profile + blocked list) instead of a waterfall.
  const [{ data: profile }, { data: blocked }] = await Promise.all([
    (supabase as any).from('users').select('genres, xp, dating_unlocked').eq('id', user.id).single(),
    (supabase as any).rpc('get_blocked_ids'),
  ])

  if (!profile) redirect('/onboarding')

  const sp = await searchParams
  const q = (sp.q ?? '').trim()
  const genre = sp.genre ?? 'all'
  const source = sp.source ?? 'community' // default to community posts only
  const sort = sp.sort ?? 'latest'

  let query = (supabase as any)
    .from('posts')
    .select('*, users(id, name, username, photo_url)')

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

  // Exclude posts by blocked users (blocked list fetched in parallel above)
  const blockedIds: string[] = (blocked ?? []).map((b: any) => b.user_id)
  if (blockedIds.length > 0) {
    query = query.not('author_id', 'in', `(${blockedIds.map((id: string) => `"${id}"`).join(',')})`)
  }

  // Sort
  const orderCol = sort === 'top' ? 'likes_count' : sort === 'discussed' ? 'comments_count' : 'created_at'
  query = query.order(orderCol, { ascending: false }).limit(30)

  const { data: posts } = await query

  // Which of these posts has the current user liked / bookmarked?
  const postIds = (posts ?? []).map((p: any) => p.id)
  let likedPostIds = new Set<string>()
  let bookmarkedPostIds = new Set<string>()
  if (postIds.length > 0) {
    const [{ data: myLikes }, { data: myBookmarks }] = await Promise.all([
      (supabase as any).from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds),
      (supabase as any).from('bookmarks').select('post_id').eq('user_id', user.id).in('post_id', postIds),
    ])
    likedPostIds = new Set((myLikes ?? []).map((l: any) => l.post_id))
    bookmarkedPostIds = new Set((myBookmarks ?? []).map((b: any) => b.post_id))
  }

  return (
    <>
      {/* Sticky search + filters, sits directly under the global header */}
      <div className="sticky top-14 z-20 bg-paper/95 backdrop-blur-md border-b border-line">
        <div className="max-w-xl mx-auto px-4 py-3">
          <FeedFilters userGenres={profile.genres} />
        </div>
      </div>

      <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
        {(posts ?? []).length === 0 ? (
          <div className="card p-8 text-center">
            <p className="font-display text-xl text-ink">{q ? 'No posts match your search' : 'Nothing here yet'}</p>
            <p className="text-ink-faint text-sm mt-1">
              {q || genre !== 'all' || source !== 'all' ? 'Try clearing some filters.' : 'Tap + to post something.'}
            </p>
          </div>
        ) : (
          (posts ?? []).map((post: any) => (
            <PostCard key={post.id} post={post} currentUserId={user.id}
              initialLiked={likedPostIds.has(post.id)} initialBookmarked={bookmarkedPostIds.has(post.id)} />
          ))
        )}
      </div>

      <CreatePost userGenres={profile.genres} userId={user.id} />
    </>
  )
}
