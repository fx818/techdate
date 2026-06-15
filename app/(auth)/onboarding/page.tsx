'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'
import { seedVector } from '@/lib/matching/vector'
import { GENRES } from '@/lib/genres'
import { isValidUsername, suggestUsername } from '@/lib/slug'
import type { Gender, Preference, Database } from '@/lib/supabase/types'

type UserInsert = Database['public']['Tables']['users']['Insert']

const CITIES = ['Bangalore', 'Delhi', 'Noida', 'Gurgaon', 'Mumbai', 'Pune', 'Hyderabad', 'Chennai']

export default function OnboardingPage() {
  const [step, setStep] = useState(1)
  const [name, setName] = useState('')
  const [username, setUsername] = useState('')
  const [usernameEdited, setUsernameEdited] = useState(false)
  const [usernameError, setUsernameError] = useState('')
  const [checkingUsername, setCheckingUsername] = useState(false)
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

  function onNameChange(value: string) {
    setName(value)
    if (!usernameEdited) setUsername(suggestUsername(value))
  }

  // Returns true if the chosen username is well-formed and not taken.
  async function validateUsername(): Promise<boolean> {
    const u = username.trim().toLowerCase()
    if (!isValidUsername(u)) {
      setUsernameError('3–20 chars: lowercase letters, numbers, underscore.')
      return false
    }
    setCheckingUsername(true)
    setUsernameError('')
    const { data: taken } = await supabase.from('users').select('id').eq('username', u).maybeSingle()
    setCheckingUsername(false)
    if (taken) { setUsernameError('That username is taken.'); return false }
    return true
  }

  async function continueFromStep1() {
    if (!name || !city) return
    if (!(await validateUsername())) return
    setStep(2)
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
      username: username.trim().toLowerCase(),
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
            <input placeholder="Full name" value={name} onChange={e => onNameChange(e.target.value)} className="input" />
            <div className="space-y-1">
              <div className="flex items-center rounded-lg border border-line-strong bg-surface focus-within:border-clay overflow-hidden">
                <span className="pl-3 text-ink-faint text-sm select-none">@</span>
                <input
                  placeholder="username"
                  value={username}
                  onChange={e => { setUsernameEdited(true); setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, '')); setUsernameError('') }}
                  maxLength={20}
                  className="flex-1 bg-transparent px-2 py-2.5 text-ink outline-none"
                />
              </div>
              {usernameError
                ? <p className="text-clay-deep text-xs">{usernameError}</p>
                : <p className="text-ink-faint text-xs">Your profile link: await.app/users/{username || 'username'}</p>}
            </div>
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
            <button onClick={continueFromStep1} disabled={!name || !city || !username || checkingUsername}
              className="btn btn-primary w-full">
              {checkingUsername ? 'Checking…' : 'Continue'}
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
