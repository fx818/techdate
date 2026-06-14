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
    <div className="max-w-xl mx-auto px-4 py-7 space-y-5">
      <div className="flex items-end justify-between">
        <div>
          <h1 className="font-display text-3xl text-ink leading-none">Feed</h1>
          <p className="text-ink-faint text-sm mt-1.5">What the community is building.</p>
        </div>
        <span className="text-sm font-mono text-clay-deep bg-clay-tint px-2.5 py-1 rounded-full">{profile.xp} XP</span>
      </div>

      <CreatePost userGenres={profile.genres} />

      {!profile.dating_unlocked && (
        <div className="rounded-xl bg-sage-tint border border-sage/20 p-3.5 text-sm text-sage flex items-center gap-2">
          <span className="font-display text-base">✦</span>
          Earn <span className="font-semibold">{100 - profile.xp}</span> more XP to unlock dating.
        </div>
      )}

      <div className="space-y-4">
        {(posts ?? []).map((post: any) => (
          <PostCard key={post.id} post={post} currentUserId={user.id} initialLiked={likedPostIds.has(post.id)} />
        ))}
      </div>
    </div>
  )
}
