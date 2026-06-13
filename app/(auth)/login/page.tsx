'use client'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [phone, setPhone] = useState('')
  const [otp, setOtp] = useState('')
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const router = useRouter()
  const supabase = createClient()

  async function sendOtp() {
    setLoading(true)
    setError('')
    const { error } = await supabase.auth.signInWithOtp({
      phone: `+91${phone}`,
    })
    if (error) setError(error.message)
    else setStep('otp')
    setLoading(false)
  }

  async function verifyOtp() {
    setLoading(true)
    setError('')
    const { data, error } = await supabase.auth.verifyOtp({
      phone: `+91${phone}`,
      token: otp,
      type: 'sms',
    })
    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }
    const { data: profile } = await supabase
      .from('users')
      .select('id')
      .eq('id', data.user!.id)
      .single()

    if (!profile) router.push('/onboarding')
    else router.push('/feed')
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-sm space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-white">TechDate</h1>
          <p className="text-gray-400 text-sm mt-1">For people who build things.</p>
        </div>

        {step === 'phone' ? (
          <div className="space-y-4">
            <div className="flex">
              <span className="bg-gray-800 text-gray-400 px-3 py-2 rounded-l-md border border-r-0 border-gray-700">+91</span>
              <input
                type="tel"
                placeholder="Phone number"
                value={phone}
                onChange={e => setPhone(e.target.value)}
                className="flex-1 bg-gray-800 text-white px-3 py-2 rounded-r-md border border-gray-700 focus:outline-none focus:border-indigo-500"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={sendOtp}
              disabled={loading || phone.length < 10}
              className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Sending...' : 'Send OTP'}
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-gray-400 text-sm">Enter the 6-digit code sent to +91{phone}</p>
            <input
              type="text"
              placeholder="000000"
              value={otp}
              onChange={e => setOtp(e.target.value)}
              maxLength={6}
              className="w-full bg-gray-800 text-white px-3 py-2 rounded-md border border-gray-700 focus:outline-none focus:border-indigo-500 text-center text-2xl tracking-widest"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              onClick={verifyOtp}
              disabled={loading || otp.length < 6}
              className="w-full bg-indigo-600 text-white py-2 rounded-md hover:bg-indigo-500 disabled:opacity-50"
            >
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              onClick={() => setStep('phone')}
              className="w-full text-gray-400 text-sm"
            >
              Change number
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
