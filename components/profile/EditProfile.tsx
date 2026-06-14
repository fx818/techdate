'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { GENRES } from '@/lib/genres'
import type { Preference } from '@/lib/supabase/types'

const CITIES = ['Bangalore', 'Delhi', 'Noida', 'Gurgaon', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai']

interface Props {
  userId: string
  initial: {
    name: string
    bio: string | null
    city: string
    genres: string[]
    preference: Preference
    photo_url: string | null
    photos: string[]
  }
}

export default function EditProfile({ userId, initial }: Props) {
  const router = useRouter()
  const supabase = createClient()
  const fileRef = useRef<HTMLInputElement>(null)

  const [open, setOpen] = useState(false)
  const [name, setName] = useState(initial.name)
  const [city, setCity] = useState(initial.city)
  const [bio, setBio] = useState(initial.bio ?? '')
  const [preference, setPreference] = useState<Preference>(initial.preference)
  const [genres, setGenres] = useState<string[]>(initial.genres ?? [])
  const [photos, setPhotos] = useState<string[]>(
    initial.photos && initial.photos.length ? initial.photos : (initial.photo_url ? [initial.photo_url] : [])
  )
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  function toggleGenre(id: string) {
    setGenres(prev =>
      prev.includes(id) ? prev.filter(g => g !== id) : prev.length < 5 ? [...prev, id] : prev
    )
  }

  async function uploadPhoto(file: File) {
    setUploading(true)
    setError('')
    try {
      const ext = file.name.split('.').pop() || 'jpg'
      const path = `${userId}/avatar_${Date.now()}.${ext}`
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, { upsert: true })
      if (upErr) { setError(upErr.message); return }
      const { data } = supabase.storage.from('avatars').getPublicUrl(path)
      setPhotos(prev => prev.length < 5 ? [...prev, data.publicUrl] : prev)
    } finally {
      setUploading(false)
    }
  }

  function removePhoto(url: string) {
    setPhotos(prev => prev.filter(p => p !== url))
  }

  async function save() {
    if (!name.trim() || !city) { setError('Name and city are required'); return }
    if (genres.length < 3) { setError('Pick at least 3 interests'); return }
    setSaving(true)
    setError('')
    const { error: updErr } = await (supabase as any)
      .from('users')
      .update({ name: name.trim(), city, bio: bio.trim() || null, preference, genres, photos, photo_url: photos[0] ?? null })
      .eq('id', userId)
    setSaving(false)
    if (updErr) { setError(updErr.message); return }
    setOpen(false)
    router.refresh()
  }

  if (!open) {
    return (
      <button onClick={() => setOpen(true)} className="btn btn-ghost w-full text-sm">
        Edit profile
      </button>
    )
  }

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 px-4 py-8 overflow-y-auto">
      <div className="card w-full max-w-md p-6 space-y-5 animate-pop my-auto">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-2xl text-ink">Edit profile</h2>
          <button onClick={() => setOpen(false)} className="text-ink-faint hover:text-ink text-sm">Close</button>
        </div>

        {/* Photos */}
        <div className="space-y-2">
          <label className="text-ink-faint text-xs uppercase tracking-widest">Photos (up to 5)</label>
          <div className="flex flex-wrap gap-2">
            {photos.map(url => (
              <div key={url} className="relative w-20 h-20 rounded-xl overflow-hidden border border-line">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  type="button"
                  onClick={() => removePhoto(url)}
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-ink/60 hover:bg-ink text-white text-xs flex items-center justify-center"
                  aria-label="Remove photo"
                >
                  ✕
                </button>
              </div>
            ))}
            {photos.length < 5 && (
              <button
                type="button"
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-20 h-20 rounded-xl border border-dashed border-line-strong bg-clay-tint text-clay-deep text-xs flex items-center justify-center"
              >
                {uploading ? 'Uploading…' : '+ Add photo'}
              </button>
            )}
          </div>
          <input ref={fileRef} type="file" accept="image/*" className="hidden"
            onChange={e => { const f = e.target.files?.[0]; if (f) uploadPhoto(f); e.target.value = '' }} />
        </div>

        <input value={name} onChange={e => setName(e.target.value)} placeholder="Full name" className="input" />
        <select value={city} onChange={e => setCity(e.target.value)} className="input">
          <option value="">Select city</option>
          {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
        </select>

        <div className="space-y-1.5">
          <label className="text-ink-faint text-xs uppercase tracking-widest">Show me</label>
          <div className="flex gap-2">
            {([['male', 'Men'], ['female', 'Women'], ['everyone', 'Everyone']] as [Preference, string][]).map(([val, label]) => (
              <button key={val} onClick={() => setPreference(val)}
                className={`flex-1 py-2 rounded-lg text-sm border transition-colors ${preference === val ? 'bg-clay border-clay text-white' : 'bg-surface border-line-strong text-ink-soft'}`}>
                {label}
              </button>
            ))}
          </div>
        </div>

        <textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="Short bio" className="input h-20 resize-none" />

        <div className="space-y-1.5">
          <label className="text-ink-faint text-xs uppercase tracking-widest">Interests (3–5)</label>
          <div className="flex flex-wrap gap-2">
            {GENRES.map(g => (
              <button key={g.id} onClick={() => toggleGenre(g.id)} className={`chip ${genres.includes(g.id) ? 'chip-on' : ''}`}>
                {g.label}
              </button>
            ))}
          </div>
        </div>

        {error && <p className="text-clay-deep text-sm">{error}</p>}

        <div className="flex gap-2 justify-end pt-1">
          <button onClick={() => setOpen(false)} className="btn btn-ghost text-sm">Cancel</button>
          <button onClick={save} disabled={saving || uploading} className="btn btn-primary text-sm">
            {saving ? 'Saving…' : 'Save changes'}
          </button>
        </div>
      </div>
    </div>
  )
}
