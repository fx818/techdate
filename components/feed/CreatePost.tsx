'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Plus } from 'lucide-react'
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

  return (
    <>
      {/* Floating compose button */}
      <button onClick={() => setOpen(true)} aria-label="New post"
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full bg-clay text-white flex items-center justify-center shadow-lg hover:bg-clay-deep transition-colors active:scale-95"
        style={{ boxShadow: '0 10px 30px -8px rgba(176,85,54,0.6)' }}>
        <Plus size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="card w-full max-w-md p-5 space-y-3 animate-pop">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink">New post</h2>
              <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink text-sm">Close</button>
            </div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="input" autoFocus />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Details (optional)"
              className="input h-28 resize-none" />
            <select value={genre} onChange={e => setGenre(e.target.value)} className="input">
              {availableGenres.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={() => setOpen(false)} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={submit} disabled={loading || !title.trim()} className="btn btn-primary text-sm">
                {loading ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
