'use client'

import { useEffect, useState } from 'react'

interface Comment {
  id: string
  content: string
  created_at: string
  users: { name: string }
}

export default function CommentSection({ postId }: { postId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then(r => r.json())
      .then(d => setComments(d.comments ?? []))
      .catch(() => {})
  }, [postId])

  async function submit() {
    if (!text.trim()) return
    setLoading(true)
    try {
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
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3 border-t border-line pt-3.5">
      {comments.map(c => (
        <div key={c.id} className="text-sm leading-relaxed">
          <span className="text-clay-deep font-medium">{c.users.name}</span>
          <span className="text-ink-soft ml-2">{c.content}</span>
        </div>
      ))}
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)}
          placeholder="Add a comment…"
          onKeyDown={e => e.key === 'Enter' && submit()}
          className="input text-sm py-1.5" />
        <button onClick={submit} disabled={loading || !text.trim()}
          className="btn btn-primary text-sm px-4 py-1.5">
          Post
        </button>
      </div>
    </div>
  )
}
