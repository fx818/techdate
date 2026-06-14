'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function ResetPasswordPage() {
  const supabase = createClient()
  const router = useRouter()
  const [password, setPassword] = useState('')
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function submit() {
    if (password.length < 6) { setError('At least 6 characters'); return }
    setLoading(true); setError('')
    const { error } = await supabase.auth.updateUser({ password })
    setLoading(false)
    if (error) { setError(error.message); return }
    setDone(true)
    setTimeout(() => router.push('/feed'), 1200)
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="card max-w-sm w-full p-8 space-y-4 animate-rise">
        <h1 className="font-display text-2xl text-ink">Set a new password</h1>
        {done ? (
          <p className="text-sage text-sm">Password updated. Taking you in…</p>
        ) : (
          <>
            <input type="password" value={password} onChange={e => setPassword(e.target.value)}
              placeholder="New password" className="input" />
            {error && <p className="text-clay-deep text-sm">{error}</p>}
            <button onClick={submit} disabled={loading} className="btn btn-primary w-full">
              {loading ? '…' : 'Update password'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
