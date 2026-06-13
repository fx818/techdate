'use client'

import { useEffect, useState } from 'react'

interface Comment {
  id: string
  content: string
  created_at: string
  users: { name: string }
}

export default function CommentSection({ postId, currentUserId }: { postId: string; currentUserId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then(r => r.json())
      .then(d => setComments(d.comments ?? []))
  }, [postId])

  async function submit() {
    if (!text.trim()) return
    setLoading(true)
    const res = await fetch(`/api/posts/${postId}/comments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content: text }),
    })
    const data = await res.json()
    if (data.comment) {
      setComments(prev => [...prev, { ...data.comment, users: { name: 'You' } }])
      setText('')
    }
    setLoading(false)
  }

  return (
    <div className="space-y-3 border-t border-gray-800 pt-3">
      {comments.map(c => (
        <div key={c.id} className="text-sm">
          <span className="text-indigo-400 font-medium">{c.users.name}</span>
          <span className="text-gray-300 ml-2">{c.content}</span>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)}
          placeholder="Add a comment..."
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="flex-1 bg-gray-800 text-white text-sm px-3 py-1.5 rounded-md border border-gray-700 focus:outline-none focus:border-indigo-500" />
        <button onClick={submit} disabled={loading || !text.trim()}
          className="bg-indigo-600 text-white text-sm px-3 py-1.5 rounded-md disabled:opacity-50">
          Post
        </button>
      </div>
    </div>
  )
}
