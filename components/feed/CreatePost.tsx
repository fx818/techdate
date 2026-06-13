'use client'

import { useState } from 'react'
import { GENRES } from '@/lib/genres'

export function CreatePost({ userGenres, onCreated }: { userGenres: string[]; onCreated: () => void }) {
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [genre, setGenre] = useState(userGenres[0] ?? '')
  const [loading, setLoading] = useState(false)

  const availableGenres = GENRES.filter(g => userGenres.includes(g.id))

  async function submit() {
    if (!title.trim() || !genre) return
    setLoading(true)
    await fetch('/api/posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, genre }),
    })
    setTitle('')
    setContent('')
    setOpen(false)
    setLoading(false)
    onCreated()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)}
        className="w-full bg-gray-900 border border-gray-700 border-dashed rounded-lg p-4 text-gray-500 hover:text-gray-300 hover:border-gray-600 text-sm text-left">
        + Share something with the community...
      </button>
    )
  }

  return (
    <div className="bg-gray-900 border border-gray-700 rounded-lg p-4 space-y-3">
      <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title"
        className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:border-indigo-500" />
      <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Details (optional)"
        className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 h-20 resize-none focus:outline-none focus:border-indigo-500" />
      <select value={genre} onChange={e => setGenre(e.target.value)}
        className="bg-gray-800 text-white px-3 py-1.5 rounded-md border border-gray-700 text-sm">
        {availableGenres.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
      </select>
      <div className="flex gap-2 justify-end">
        <button onClick={() => setOpen(false)} className="text-gray-400 text-sm px-3 py-1.5">Cancel</button>
        <button onClick={submit} disabled={loading || !title.trim()}
          className="bg-indigo-600 text-white text-sm px-4 py-1.5 rounded-md disabled:opacity-50">
          {loading ? 'Posting...' : 'Post'}
        </button>
      </div>
    </div>
  )
}
