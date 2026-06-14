import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { PostCard } from '@/components/feed/PostCard'
import { CreatePost } from '@/components/feed/CreatePost'

export default async function FeedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await (supabase as any)
    .from('users')
    .select('genres, xp, dating_unlocked')
    .eq('id', user.id)
    .single()

  if (!profile) redirect('/onboarding')

  const { data: posts } = await (supabase as any)
    .from('posts')
    .select('*, users(id, name, photo_url)')
    .in('genre', profile.genres)
    .order('created_at', { ascending: false })
    .limit(20)

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
    <div className="max-w-xl mx-auto px-4 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-white">Feed</h1>
        <span className="text-sm text-indigo-400">{profile.xp} XP</span>
      </div>

      <CreatePost userGenres={profile.genres} />

      {!profile.dating_unlocked && (
        <div className="bg-indigo-950/40 border border-indigo-800/50 rounded-lg p-3 text-sm text-indigo-300">
          Earn {100 - profile.xp} more XP to unlock dating
        </div>
      )}

      <div className="space-y-3">
        {(posts ?? []).map((post: any) => (
          <PostCard key={post.id} post={post} currentUserId={user.id} initialLiked={likedPostIds.has(post.id)} />
        ))}
      </div>
    </div>
  )
}
