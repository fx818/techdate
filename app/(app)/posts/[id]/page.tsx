import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { BackButton } from '@/components/feed/BackButton'
import { GideonBadge } from '@/components/ui/GideonBadge'
import { PostActions } from '@/components/feed/PostActions'
import CommentSection from '@/components/feed/CommentSection'
import { PostOwnerMenu } from '@/components/feed/PostOwnerMenu'
import { PostSafetyMenu } from '@/components/feed/PostSafetyMenu'
import { formatFull } from '@/lib/time'
import { isUuid } from '@/lib/slug'

export default async function PostDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id: slugOrId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  // Public page: logged-out visitors get a read-only view (shareable links).

  // Resolve by slug; fall back to a legacy UUID URL and redirect to the canonical slug.
  let { data: post } = await (supabase as any)
    .from('posts')
    .select('*, users(id, name, username, photo_url)')
    .eq('slug', slugOrId)
    .maybeSingle()

  if (!post && isUuid(slugOrId)) {
    ({ data: post } = await (supabase as any)
      .from('posts')
      .select('*, users(id, name, username, photo_url)')
      .eq('id', slugOrId)
      .maybeSingle())
    if (post) redirect(`/posts/${post.slug}`)
  }

  if (!post) redirect('/feed')

  const id = post.id
  const isAuthed = !!user

  // Like/bookmark state only applies to a signed-in viewer.
  let like: any = null, bookmark: any = null
  if (user) {
    ;[{ data: like }, { data: bookmark }] = await Promise.all([
      (supabase as any).from('likes').select('id').eq('user_id', user.id).eq('post_id', id).maybeSingle(),
      (supabase as any).from('bookmarks').select('id').eq('user_id', user.id).eq('post_id', id).maybeSingle(),
    ])
  }

  const author = post.users?.name ?? 'Unknown'

  return (
    <div className="max-w-xl mx-auto px-4 py-5 space-y-5">
      <BackButton />

      <article className="card p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            {post.is_gideon ? <GideonBadge /> : (
              <Link href={`/users/${post.users?.username ?? post.users?.id}`} className="flex items-center gap-2.5">
                <div className="w-7 h-7 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep text-sm font-display overflow-hidden shrink-0">
                  {post.users?.photo_url
                    ? <img src={post.users.photo_url} alt={author} className="w-7 h-7 object-cover" />
                    : author[0]?.toUpperCase()}
                </div>
                <span className="text-sm text-ink-soft font-medium">{author}</span>
              </Link>
            )}
            <span className="text-xs bg-surface-sunk text-ink-faint px-2 py-0.5 rounded-full">{post.genre}</span>
          </div>
          {user && !post.is_gideon && (
            post.users?.id === user.id
              ? <PostOwnerMenu postId={post.id} title={post.title} content={post.content} />
              : post.users?.id
                ? <PostSafetyMenu postId={post.id} authorId={post.users.id} />
                : null
          )}
        </div>

        <h1 className="font-display text-2xl text-ink leading-snug">{post.title}</h1>
        <p className="text-ink-faint text-xs">{formatFull(post.created_at)}</p>
        {post.content && <p className="text-ink-soft leading-relaxed whitespace-pre-wrap">{post.content}</p>}

        {post.image_url && (
          <img src={post.image_url} alt="" className="w-full rounded-xl border border-line object-cover" />
        )}

        {post.url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer"
            className="inline-block text-sm text-clay-deep hover:underline break-all">{post.url}</a>
        )}

        <div className="pt-1">
          <PostActions postId={id} initialLiked={!!like} initialBookmarked={!!bookmark} initialLikeCount={post.likes_count} isAuthed={isAuthed} />
        </div>
      </article>

      {!isAuthed && (
        <div className="card p-5 text-center space-y-2 border-clay/40 bg-clay-tint/30">
          <p className="font-display text-xl text-ink">Join the conversation</p>
          <p className="text-ink-faint text-sm">Sign up to like, save, comment, and connect with techies who think like you.</p>
          <Link href="/login" className="btn btn-primary inline-flex mt-1">Log in / Sign up</Link>
        </div>
      )}

      <div className="card p-5">
        <h2 className="font-display text-lg text-ink mb-3">Comments</h2>
        <CommentSection postId={id} currentUserId={user?.id ?? ''} />
      </div>
    </div>
  )
}
