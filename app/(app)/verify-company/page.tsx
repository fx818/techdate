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
      <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
        <div className="w-full max-w-sm space-y-4 text-center">
          <div className="text-4xl">📬</div>
          <h2 className="text-xl font-bold text-white">Check your work email</h2>
          <p className="text-gray-400 text-sm">
            We sent a confirmation link to <span className="text-white">{email}</span>.
            Click it to verify and continue using TechDate.
          </p>
          <button onClick={() => setSent(false)} className="text-indigo-400 text-sm hover:text-indigo-300">
            Use a different email
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <div className="text-3xl">🏢</div>
          <h2 className="text-xl font-bold text-white">Verify your work email</h2>
          <p className="text-gray-400 text-sm">
            Your 7-day trial has ended. Enter your company email to keep access.
            Personal emails (Gmail, Yahoo, etc.) are not accepted.
          </p>
        </div>

        <div className="space-y-3">
          <input
            type="email"
            placeholder="you@yourcompany.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendVerification()}
            className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:border-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            onClick={sendVerification}
            disabled={loading || !email.includes('@')}
            className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50"
          >
            {loading ? 'Sending...' : 'Send verification email'}
          </button>
        </div>

        <p className="text-gray-600 text-xs text-center">
          You&apos;ll receive a confirmation link. Click it to verify ownership.
        </p>
      </div>
    </div>
  )
}
