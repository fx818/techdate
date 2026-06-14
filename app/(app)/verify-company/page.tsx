'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { isPersonalEmail } from '@/lib/auth/email'

export default function VerifyCompanyPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const supabase = createClient()

  async function sendVerification() {
    if (isPersonalEmail(email)) {
      setError('Please enter a company email — Gmail, Yahoo, Hotmail and similar are not accepted.')
      return
    }
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${location.origin}/auth/callback?type=email_change` }
    )
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setSent(true)
    setLoading(false)
  }

  if (sent) {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="card max-w-sm w-full p-8 text-center space-y-4 animate-pop">
          <div className="mx-auto w-14 h-14 rounded-full bg-clay-tint flex items-center justify-center text-2xl">✶</div>
          <h2 className="font-display text-2xl text-ink">Check your work email</h2>
          <p className="text-ink-soft text-sm leading-relaxed">
            We sent a confirmation link to <span className="text-ink font-medium">{email}</span>. Click it to verify and continue using TechDate.
          </p>
          <button onClick={() => setSent(false)} className="text-clay-deep text-sm font-medium hover:underline">
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-5">
      <div className="card max-w-sm w-full p-8 space-y-6 animate-rise">
        <div className="space-y-2">
          <div className="font-display text-4xl text-clay/70">✦</div>
          <h2 className="font-display text-2xl text-ink">Verify your work email</h2>
          <p className="text-ink-soft text-sm leading-relaxed">
            Your 7-day trial has ended. Enter your company email to keep access — personal emails (Gmail, Yahoo, etc.) aren&apos;t accepted.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="you@yourcompany.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendVerification()}
            className="input"
          />
          {error && <p className="text-clay-deep text-sm">{error}</p>}
          <button
            onClick={sendVerification}
            disabled={loading || !email.includes('@')}
            className="btn btn-primary w-full"
          >
            {loading ? 'Sending…' : 'Send verification email'}
          </button>
        </div>

        <p className="text-ink-faint text-xs text-center">
          You&apos;ll receive a confirmation link. Click it to verify ownership.
        </p>
      </div>
    </div>
  )
}
