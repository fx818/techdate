'use client'

import { useState } from 'react'
import { Heart, MessageSquare, ExternalLink } from 'lucide-react'
import { GideonBadge } from '@/components/ui/GideonBadge'
import CommentSection from './CommentSection'

interface Post {
  id: string
  title: string
  content: string | null
  url: string | null
  genre: string
  is_gideon: boolean
  likes_count: number
  comments_count: number
  created_at: string
  users: { id: string; name: string; photo_url: string | null } | null
}

export function PostCard({ post, currentUserId, initialLiked = false }: { post: Post; currentUserId: string; initialLiked?: boolean }) {
  const [liked, setLiked] = useState(initialLiked)
  const [likeCount, setLikeCount] = useState(post.likes_count)
  const [showComments, setShowComments] = useState(false)
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
      setLikeCount(prev => data.liked ? prev + 1 : prev - 1)
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-lg p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 flex-wrap">
          {post.is_gideon ? (
            <GideonBadge />
          ) : (
            <span className="text-sm text-gray-400">{post.users?.name ?? 'Unknown'}</span>
          )}
          <span className="text-xs bg-gray-800 text-gray-400 px-2 py-0.5 rounded-full">{post.genre}</span>
        </div>
        {post.url && (
          <a href={post.url} target="_blank" rel="noopener noreferrer" className="text-gray-500 hover:text-gray-300">
            <ExternalLink size={14} />
          </a>
        )}
      </div>

      <h3 className="text-white font-medium leading-snug">{post.title}</h3>
      {post.content && <p className="text-gray-400 text-sm">{post.content}</p>}

      <div className="flex items-center gap-4 pt-1">
        <button onClick={toggleLike} disabled={pending} className={`flex items-center gap-1.5 text-sm disabled:opacity-60 ${liked ? 'text-red-400' : 'text-gray-500 hover:text-gray-300'}`}>
          <Heart size={15} fill={liked ? 'currentColor' : 'none'} />
          {likeCount}
        </button>
        <button onClick={() => setShowComments(!showComments)} className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300">
          <MessageSquare size={15} />
          {post.comments_count}
        </button>
      </div>

      {showComments && <CommentSection postId={post.id} />}
    </div>
  )
}
