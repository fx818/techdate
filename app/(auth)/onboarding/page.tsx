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
  const [preference, setPreference] = useState<Preference>('everyone')
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
    <div className="min-h-screen bg-gray-950 px-4 py-8">
      <div className="max-w-md mx-auto space-y-6">
        <div className="flex gap-2">
          {[1, 2].map(s => (
            <div key={s} className={`h-1 flex-1 rounded-full ${step >= s ? 'bg-indigo-500' : 'bg-gray-700'}`} />
          ))}
        </div>

        {step === 1 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Your profile</h2>
            <input placeholder="Full name" value={name} onChange={e => setName(e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700" />
            <select value={city} onChange={e => setCity(e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700">
              <option value="">Select city</option>
              {CITIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="flex gap-3">
              {(['male', 'female', 'non_binary'] as Gender[]).map(g => (
                <button key={g} onClick={() => setGender(g)}
                  className={`flex-1 py-2 rounded-md text-sm capitalize ${gender === g ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400'}`}>
                  {g.replace('_', ' ')}
                </button>
              ))}
            </div>
            <textarea placeholder="Short bio (optional)" value={bio} onChange={e => setBio(e.target.value)}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 h-24 resize-none" />
            <button onClick={() => { if (name && city) setStep(2) }}
              disabled={!name || !city}
              className="w-full bg-indigo-600 text-white py-2 rounded-md disabled:opacity-50">
              Next
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">Pick your interests</h2>
            <p className="text-gray-400 text-sm">Choose 3–5 topics you care about</p>
            <div className="flex flex-wrap gap-2">
              {GENRES.map(g => (
                <button key={g.id} onClick={() => toggleGenre(g.id)}
                  className={`px-3 py-1.5 rounded-full text-sm border ${selectedGenres.includes(g.id)
                    ? 'bg-indigo-600 border-indigo-600 text-white'
                    : 'bg-gray-800 border-gray-700 text-gray-300'}`}>
                  {g.label}
                </button>
              ))}
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button onClick={submit} disabled={loading || selectedGenres.length < 3}
              className="w-full bg-indigo-600 text-white py-2 rounded-md disabled:opacity-50">
              {loading ? 'Setting up...' : "Let's go"}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
