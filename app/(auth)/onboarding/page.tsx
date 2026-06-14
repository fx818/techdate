'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { seedVector } from '@/lib/matching/vector'
import { GENRES } from '@/lib/genres'
import type { Gender, Preference, Database } from '@/lib/supabase/types'

type UserInsert = Database['public']['Tables']['users']['Insert']

const CITIES = ['Bangalore', 'Delhi', 'Noida', 'Gurgaon', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai']

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [city, setCity] = useState('')
  const [gender, setGender] = useState<Gender>('male')
  // Stored on the profile for future use; no dating-preference UI in the networking model.
  const [preference] = useState<Preference>('everyone')
  const [bio, setBio] = useState('')
  const [selectedGenres, setSelectedGenres] = useState<string[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  function toggleGenre(id: string) {
    setSelectedGenres(prev =>
      prev.includes(id)
        ? prev.filter(g => g !== id)
        : prev.length < 5 ? [...prev, id] : prev
    )
  }

  async function submit() {
    if (selectedGenres.length < 3) {
      setError('Pick at least 3 genres')
      return
    }
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { router.push('/login'); return }

    const vector = seedVector(selectedGenres)

    const payload: UserInsert = {
      id: user.id,
      email: user.email ?? null,
      phone: user.phone ?? null,
      name,
      bio,
      city,
      gender,
      preference,
      photo_url: null,
      genres: selectedGenres,
      interest_vector: vector,
      last_active: new Date().toISOString(),
    }
    const { error: insertError } = await supabase.from('users').insert(payload as never)

    if (insertError) { setError(insertError.message); setLoading(false); return }

    await fetch('/api/xp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'profile_complete' }),
    })

    router.push('/feed')
  }

  return (
    <div className="min-h-screen px-5 py-10">
      <div className="max-w-md mx-auto space-y-7">
        <div className="space-y-3">
          <span className="font-display text-xl text-ink">Await</span>
          <div className="flex gap-2">
            {[1, 2].map(s => (
              <div key={s} className={`h-1.5 flex-1 rounded-full transition-colors ${step >= s ? 'bg-clay' : 'bg-line'}`} />
            ))}
          </div>
        </div>

        {step === 1 && (
          <div className="space-y-5 animate-rise">
            <div>
              <h2 className="font-display text-3xl text-ink">Your profile</h2>
              <p className="text-ink-soft text-sm mt-1">Tell us who you are.</p>
            </div>
            <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)} className="input" />
            <select value={city} onChange={e => setCity(e.target.value)} className="input">
              <option value="">Select city</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="space-y-1.5">
              <label className="text-ink-faint text-xs uppercase tracking-widest">I am</label>
              <div className="flex gap-2">
                {(['male', 'female', 'non_binary'] as Gender[]).map(g => (
                  <button key={g} onClick={() => setGender(g)}
                    className={`flex-1 py-2 rounded-lg text-sm capitalize border transition-colors ${gender === g ? 'bg-clay border-clay text-white' : 'bg-surface border-line-strong text-ink-soft'}`}>
                    {g.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>
            <textarea placeholder="Short bio (optional)" value={bio} onChange={e => setBio(e.target.value)}
              className="input h-24 resize-none" />
            <button onClick={() => { if (name && city) setStep(2) }} disabled={!name || !city}
              className="btn btn-primary w-full">
              Continue
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-5 animate-rise">
            <div>
              <h2 className="font-display text-3xl text-ink">Pick your interests</h2>
              <p className="text-ink-soft text-sm mt-1">Choose 3–5 topics you care about.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button key={g.id} onClick={() => toggleGenre(g.id)}
                  className={`chip ${selectedGenres.includes(g.id) ? 'chip-on' : ''}`}>
                  {g.label}
                </button>
              ))}
            </div>
            {error && <p className="text-clay-deep text-sm">{error}</p>}
            <button onClick={submit} disabled={loading || selectedGenres.length < 3} className="btn btn-primary w-full">
              {loading ? 'Setting up···' : "Let's go"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
