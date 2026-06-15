'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

type Mode = 'signin' | 'signup' | 'check_email'

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>('signin')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function handleSignIn() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const { data: profile } = await supabase.from('users').select('id').eq('id', (await supabase.auth.getUser()).data.user!.id).single()
    router.push(profile ? '/feed' : '/onboarding')
    setLoading(false)
  }

  async function handleSignUp() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${location.origin}/auth/callback`,
      },
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    setMode('check_email')
    setLoading(false)
  }

  async function handleForgot() {
    if (!email) { setError('Enter your email first'); return }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${location.origin}/auth/callback?type=recovery`,
    })
    if (error) { setError(error.message); return }
    setError('')
    setMode('check_email')
  }

  if (mode === 'check_email') {
    return (
      <div className="min-h-screen flex items-center justify-center px-5">
        <div className="card max-w-sm w-full p-8 text-center space-y-4 animate-pop">
          <div className="mx-auto w-14 h-14 rounded-full bg-clay-tint flex items-center justify-center text-2xl">✶</div>
          <h2 className="font-display text-2xl text-ink">Check your inbox</h2>
          <p className="text-ink-soft text-sm leading-relaxed">
            We sent a confirmation link to <span className="text-ink font-medium">{email}</span>. Open it to activate your account.
          </p>
          <button onClick={() => setMode('signin')} className="text-clay-deep text-sm font-medium hover:underline">
            Back to sign in
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Editorial brand panel */}
      <div className="hidden lg:flex flex-col justify-between p-12 bg-clay-tint/50 border-r border-line">
        <span className="font-display text-2xl text-ink">Await</span>
        <div className="space-y-6">
          <h1 className="font-display text-6xl leading-[1.05] text-ink">
            Some connections are worth the <span className="text-clay-deep italic">await</span>.
          </h1>
          <p className="text-ink-soft text-lg max-w-md leading-relaxed">
            Talk shop with engineers who get it. Earn your way in. Then, maybe, meet someone who debugs like you do.
          </p>
        </div>
        <p className="text-ink-faint text-sm font-mono">discuss → contribute → connect</p>
      </div>

      {/* Auth panel */}
      <div className="flex items-center justify-center px-5 py-12">
        <div className="w-full max-w-sm space-y-7 animate-rise">
          <div className="lg:hidden space-y-1">
            <h1 className="font-display text-4xl text-ink">Await</h1>
            <p className="text-ink-soft text-sm">Some connections are worth the await.</p>
          </div>

          <div className="space-y-1">
            <h2 className="font-display text-2xl text-ink hidden lg:block">
              {mode === 'signin' ? 'Welcome back' : 'Create your account'}
            </h2>
            <div className="flex gap-1 p-1 rounded-xl bg-surface-sunk border border-line w-fit">
              <button
                onClick={() => setMode('signin')}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${mode === 'signin' ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'}`}
              >
                Sign in
              </button>
              <button
                onClick={() => setMode('signup')}
                className={`px-4 py-1.5 text-sm rounded-lg transition-colors ${mode === 'signup' ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'}`}
              >
                Sign up
              </button>
            </div>
          </div>

          <div className="space-y-3">
            <input
              type="email"
              placeholder="Email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="input"
            />
            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (mode === 'signin' ? handleSignIn() : handleSignUp())}
              className="input"
            />
            {error && <p className="text-clay-deep text-sm">{error}</p>}
            {mode === 'signin' && (
              <button onClick={handleForgot} className="text-clay-deep text-xs hover:underline self-start">
                Forgot password?
              </button>
            )}
            <button
              onClick={mode === 'signin' ? handleSignIn : handleSignUp}
              disabled={loading || !email || password.length < 6}
              className="btn btn-primary w-full"
            >
              {loading ? '···' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </div>

          {mode === 'signup' && (
            <p className="text-ink-faint text-xs leading-relaxed">
              Sign up with any email. If it&apos;s a personal email (Gmail, Outlook, etc.), you&apos;ll need to verify a company email within 7 days.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}
