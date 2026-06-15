import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { BackButton } from '@/components/feed/BackButton'
import { PostCard } from '@/components/feed/PostCard'

export default async function MyPostsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: posts } = await (supabase as any)
    .from('posts')
    .select('*, users(id, name, username, photo_url)')
    .eq('author_id', user.id)
    .eq('is_gideon', false)
    .order('created_at', { ascending: false })
    .limit(50)

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

  return (
    <div className="max-w-xl mx-auto px-4 py-7 space-y-4">
      <BackButton />
      <h1 className="font-display text-3xl text-ink leading-none">My posts</h1>

      {(posts ?? []).length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">No posts yet</p>
          <p className="text-ink-faint text-sm mt-1">Tap + on the feed to share something.</p>
        </div>
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
