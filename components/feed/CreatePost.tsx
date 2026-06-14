'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { GENRES } from '@/lib/genres'

export function CreatePost({ userGenres }: { userGenres: string[] }) {
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [genre, setGenre] = useState(userGenres[0] ?? '')
  const [loading, setLoading] = useState(false)

  const availableGenres = GENRES.filter(g => userGenres.includes(g.id))

  async function submit() {
    if (!title.trim() || !genre) return
    setLoading(true)
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, genre }),
      })
      setTitle('')
      setContent('')
      setOpen(false)
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full card border-dashed border-line-strong p-4 text-ink-faint hover:text-ink hover:border-clay text-sm text-left transition-colors">
        + Share something with the community…
      </button>
    )
  }

  return (
    <div className="card p-4 space-y-3 animate-rise">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="input" />
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Details (optional)"
        className="input h-20 resize-none" />
      <select value={genre} onChange={e => setGenre(e.target.value)} className="input text-sm py-1.5 w-auto">
        {availableGenres.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
      </select>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="btn btn-ghost text-sm">Cancel</button>
        <button onClick={submit} disabled={loading || !title.trim()} className="btn btn-primary text-sm">
          {loading ? 'Posting…' : 'Post'}
        </button>
      </div>
    </div>
  )
}
