'use client'

import { useState } from 'react'
import { Heart, Bookmark } from 'lucide-react'

export function PostActions({
  postId,
  initialLiked,
  initialBookmarked,
  initialLikeCount,
}: {
  postId: string
  initialLiked: boolean
  initialBookmarked: boolean
  initialLikeCount: number
}) {
  const [liked, setLiked] = useState(initialLiked)
  const [likeCount, setLikeCount] = useState(initialLikeCount)
  const [bookmarked, setBookmarked] = useState(initialBookmarked)
  const [pending, setPending] = useState(false)

  async function toggleLike() {
    if (pending) return
    setPending(true)
    try {
      const res = await fetch(`/api/posts/${postId}/like`, { method: 'POST' })
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
    const res = await fetch(`/api/posts/${postId}/bookmark`, { method: 'POST' })
    if (!res.ok) return
    const data = await res.json()
    if (typeof data.bookmarked === 'boolean') setBookmarked(data.bookmarked)
  }

  return (
    <div className="flex items-center gap-5">
      <button onClick={toggleLike} disabled={pending}
        className={`flex items-center gap-1.5 text-sm transition-colors disabled:opacity-60 ${liked ? 'text-clay-deep' : 'text-ink-faint hover:text-clay'}`}>
        <Heart size={18} fill={liked ? 'currentColor' : 'none'} />
        {likeCount}
      </button>
      <button onClick={toggleBookmark}
        className={`ml-auto transition-colors ${bookmarked ? 'text-clay-deep' : 'text-ink-faint hover:text-ink'}`}
        aria-label={bookmarked ? 'Remove bookmark' : 'Save post'}>
        <Bookmark size={18} fill={bookmarked ? 'currentColor' : 'none'} />
      </button>
    </div>
  )
}
