'use client'

import { useEffect, useState } from 'react'
import { timeAgo } from '@/lib/time'

interface Comment {
  id: string
  content: string
  created_at: string
  parent_id: string | null
  author_id: string
  users: { id: string; name: string; photo_url: string | null } | null
}

export default function CommentSection({ postId, currentUserId }: { postId: string; currentUserId: string }) {
  const [comments, setComments] = useState<Comment[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [replyTo, setReplyTo] = useState<string | null>(null)
  const [replyText, setReplyText] = useState('')

  useEffect(() => {
    fetch(`/api/posts/${postId}/comments`)
      .then(r => r.json())
      .then(d => setComments(d.comments ?? []))
      .catch(() => {})
  }, [postId])

  async function submit(parentId: string | null, value: string) {
    const content = value.trim()
    if (!content) return
    setLoading(true)
    try {
      const res = await fetch(`/api/posts/${postId}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, parent_id: parentId }),
      })
      const data = await res.json()
      if (data.comment) {
        setComments(prev => [...prev, data.comment])
        if (parentId) { setReplyText(''); setReplyTo(null) } else { setText('') }
      }
    } finally {
      setLoading(false)
    }
  }

  async function remove(commentId: string) {
    await fetch(`/api/posts/${postId}/comments/${commentId}`, { method: 'DELETE' })
    setComments(prev => prev.filter(c => c.id !== commentId && c.parent_id !== commentId))
  }

  const topLevel = comments.filter(c => !c.parent_id)
  const repliesOf = (id: string) => comments.filter(c => c.parent_id === id)

  function Row({ c, isReply }: { c: Comment; isReply?: boolean }) {
    return (
      <div className={isReply ? 'ml-6 border-l border-line pl-3' : ''}>
        <div className="text-sm leading-relaxed">
          <span className="text-clay-deep font-medium">{c.users?.name ?? 'User'}</span>
          {c.created_at && <span className="text-ink-faint text-xs ml-2">{timeAgo(c.created_at)}</span>}
          <span className="text-ink-soft ml-2">{c.content}</span>
        </div>
        <div className="flex gap-3 mt-0.5">
          {!isReply && (
            <button onClick={() => { setReplyTo(replyTo === c.id ? null : c.id); setReplyText('') }}
              className="text-ink-faint text-xs hover:text-ink">Reply</button>
          )}
          {c.author_id === currentUserId && (
            <button onClick={() => remove(c.id)} className="text-ink-faint text-xs hover:text-clay-deep">Delete</button>
          )}
        </div>
        {!isReply && replyTo === c.id && (
          <div className="flex gap-2 mt-2">
            <input value={replyText} onChange={e => setReplyText(e.target.value)} autoFocus
              placeholder="Write a reply…" onKeyDown={e => e.key === 'Enter' && submit(c.id, replyText)}
              className="input text-sm py-1.5" />
            <button onClick={() => submit(c.id, replyText)} disabled={loading || !replyText.trim()}
              className="btn btn-primary text-sm px-4 py-1.5">Reply</button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-3 border-t border-line pt-3.5">
      {topLevel.map(c => (
        <div key={c.id} className="space-y-2">
          <Row c={c} />
          {repliesOf(c.id).map(r => <Row key={r.id} c={r} isReply />)}
        </div>
      ))}
      <div className="flex gap-2">
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Add a comment…"
          onKeyDown={e => e.key === 'Enter' && submit(null, text)} className="input text-sm py-1.5" />
        <button onClick={() => submit(null, text)} disabled={loading || !text.trim()}
          className="btn btn-primary text-sm px-4 py-1.5">Post</button>
      </div>
    </div>
  )
}
