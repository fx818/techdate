'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Plus, ImagePlus, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { GENRES } from '@/lib/genres'

export function CreatePost({ userGenres, userId }: { userGenres: string[]; userId: string }) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [genre, setGenre] = useState(userGenres[0] ?? '')
  const [imageUrl, setImageUrl] = useState<string | null>(null)
  const [uploading, setUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  const availableGenres = GENRES.filter(g => userGenres.includes(g.id))

  // Let other components (e.g. the first-run nudge) open the composer.
  useEffect(() => {
    const openComposer = () => setOpen(true)
    window.addEventListener('await:new-post', openComposer)
    return () => window.removeEventListener('await:new-post', openComposer)
  }, [])

  async function uploadImage(file: File) {
    setUploading(true)
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${userId}/${Date.now()}.${ext}`
      const { error } = await supabase.storage.from('post-images').upload(path, file, { upsert: true })
      if (!error) {
        const { data } = supabase.storage.from('post-images').getPublicUrl(path)
        setImageUrl(data.publicUrl)
      }
    } finally {
      setUploading(false)
    }
  }

  function reset() {
    setTitle(''); setContent(''); setImageUrl(null); setOpen(false)
  }

  async function submit() {
    if (!title.trim() || !genre) return
    setLoading(true)
    try {
      await fetch('/api/posts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content, genre, image_url: imageUrl }),
      })
      reset()
      router.refresh()
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
      <button onClick={() => setOpen(true)} aria-label="New post"
        className="fixed bottom-24 right-5 z-30 w-14 h-14 rounded-full bg-clay text-white flex items-center justify-center shadow-lg hover:bg-clay-deep transition-colors active:scale-95"
        style={{ boxShadow: '0 10px 30px -8px rgba(176,85,54,0.6)' }}>
        <Plus size={26} />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center px-4 py-8 overflow-y-auto">
          <div className="card w-full max-w-md p-5 space-y-3 animate-pop my-auto">
            <div className="flex items-center justify-between">
              <h2 className="font-display text-2xl text-ink">New post</h2>
              <button onClick={reset} className="text-ink-faint hover:text-ink text-sm">Close</button>
            </div>
            <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title" className="input" autoFocus />
            <textarea value={content} onChange={e => setContent(e.target.value)} placeholder="Details (optional)"
              className="input h-24 resize-none" />

            {imageUrl ? (
              <div className="relative">
                <img src={imageUrl} alt="" className="w-full rounded-xl border border-line max-h-64 object-cover" />
                <button onClick={() => setImageUrl(null)}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-ink/70 text-white flex items-center justify-center">
                  <X size={15} />
                </button>
              </div>
            ) : (
              <button onClick={() => fileRef.current?.click()} disabled={uploading}
                className="flex items-center gap-2 text-sm text-ink-soft hover:text-clay-deep transition-colors">
                <ImagePlus size={18} /> {uploading ? 'Uploading…' : 'Add image'}
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={e => { const f = e.target.files?.[0]; if (f) uploadImage(f) }} />

            <select value={genre} onChange={e => setGenre(e.target.value)} className="input">
              {availableGenres.map(g => <option key={g.id} value={g.id}>{g.label}</option>)}
            </select>
            <div className="flex gap-2 justify-end pt-1">
              <button onClick={reset} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={submit} disabled={loading || uploading || !title.trim()} className="btn btn-primary text-sm">
                {loading ? 'Posting…' : 'Post'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
