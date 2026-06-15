import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { PostCard } from '@/components/feed/PostCard'

export default async function SavedPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: rows } = await (supabase as any)
    .from('bookmarks')
    .select('created_at, post:posts(*, users(id, name, username, photo_url))')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const posts = (rows ?? []).map((r: any) => r.post).filter(Boolean)

  // Which of these has the user liked?
  const postIds = posts.map((p: any) => p.id)
  let likedPostIds = new Set<string>()
  if (postIds.length > 0) {
    const { data: myLikes } = await (supabase as any)
      .from('likes').select('post_id').eq('user_id', user.id).in('post_id', postIds)
    likedPostIds = new Set((myLikes ?? []).map((l: any) => l.post_id))
  }

  return (
    <div className="max-w-xl mx-auto px-4 py-5 space-y-4">
      <Link href="/profile" className="inline-flex items-center gap-1 text-ink-faint hover:text-ink text-sm">
        <ChevronLeft size={16} /> Back
      </Link>
      <h1 className="font-display text-3xl text-ink leading-none">Saved</h1>

      {posts.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">Nothing saved yet</p>
          <p className="text-ink-faint text-sm mt-1">Tap the bookmark on any post to save it for later.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((post: any) => (
            <PostCard key={post.id} post={post} currentUserId={user.id}
              initialLiked={likedPostIds.has(post.id)} initialBookmarked />
          ))}
        </div>
      )}
    </div>
  )
}
