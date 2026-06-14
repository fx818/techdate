'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Heart, MessageSquare, Bookmark, ExternalLink } from 'lucide-react'
import { GideonBadge } from '@/components/ui/GideonBadge'
import { timeAgo } from '@/lib/time'

interface Post {
  id: string
  title: string
  content: string | null
  url: string | null
  image_url: string | null
  genre: string
  is_gideon: boolean
  likes_count: number
  comments_count: number
  created_at: string
  users: { id: string; name: string; photo_url: string | null } | null
}

export function PostCard({
  post,
  currentUserId,
  initialLiked = false,
  initialBookmarked = false,
}: {
  post: Post
  currentUserId: string
  initialLiked?: boolean
  initialBookmarked?: boolean
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [likeCount, setLikeCount] = useState(post.likes_count)
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [pending, setPending] = useState(false)

  async function toggleLike() {
    if (pending) return
    setPending(true)
    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' })
      if (!res.ok) return
      const data = await res.json()
      if (typeof data.liked !== 'boolean') return
      setLiked(data.liked)
      setLikeCount(prev => (data.liked ? prev + 1 : prev - 1))
    } finally {
      setPending(false)
    }
  }

  async function toggleBookmark() {
    const res = await fetch(`/api/posts/${post.id}/bookmark`, { method: 'POST' })
    if (!res.ok) return
    const data = await res.json()
    if (typeof data.bookmarked === 'boolean') setBookmarked(data.bookmarked)
  }

  const author = post.users?.name ?? 'Unknown'

  return (
    <div className="card p-5 space-y-3">
      {/* Author + meta — author links to their profile */}
      <div className="flex items-center gap-2.5">
        {post.is_gideon ? (
          <GideonBadge />
        ) : (
          <Link href={`/users/${post.users?.id}`} className="flex items-center gap-2.5 group/author">
            <div className="w-7 h-7 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep text-sm font-display overflow-hidden shrink-0">
              {post.users?.photo_url
                ? <img src={post.users.photo_url} alt={author} className="w-7 h-7 object-cover" />
                : author[0]?.toUpperCase()}
            </div>
            <span className="text-sm text-ink-soft font-medium group-hover/author:text-clay-deep transition-colors">{author}</span>
          </Link>
        )}
        <span className="text-xs bg-surface-sunk text-ink-faint px-2 py-0.5 rounded-full">{post.genre}</span>
        <span className="text-ink-faint text-xs ml-auto">{timeAgo(post.created_at)}</span>
      </div>

      <Link href={`/posts/${post.id}`} className="block space-y-3 group">
        <h3 className="font-display text-xl text-ink leading-snug group-hover:text-clay-deep transition-colors">{post.title}</h3>
        {post.content && <p className="text-ink-soft text-sm leading-relaxed line-clamp-3">{post.content}</p>}
        {post.image_url && (
          <img src={post.image_url} alt="" className="w-full rounded-xl border border-line max-h-96 object-cover" />
        )}
      </Link>

      {/* Actions */}
      <div className="flex items-center gap-5 pt-1">
        <button onClick={toggleLike} disabled={pending}
          className={`flex items-center gap-1.5 text-sm transition-colors disabled:opacity-60 ${liked ? 'text-clay-deep' : 'text-ink-faint hover:text-clay'}`}>
          <Heart size={16} fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </button>
        <Link href={`/posts/${post.id}`} className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink transition-colors">
          <MessageSquare size={16} />
          {post.comments_count}
        </Link>
        {post.url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer"
            className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-clay-deep transition-colors">
            <ExternalLink size={15} />
          </a>
        )}
        <button onClick={toggleBookmark}
          className={`ml-auto transition-colors ${bookmarked ? 'text-clay-deep' : 'text-ink-faint hover:text-ink'}`}
          aria-label={bookmarked ? 'Remove bookmark' : 'Save post'}>
          <Bookmark size={17} fill={bookmarked ? 'currentColor' : 'none'} />
        </button>
      </div>
    </div>
  )
}
