'use client'

import { useRouter } from 'next/navigation'
import { createBrowserClient } from '@supabase/ssr'

export default function SignOutButton() {
  const router = useRouter()

  async function signOut() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <button onClick={signOut}
      className="w-full border border-gray-700 text-gray-400 py-2 rounded-lg text-sm hover:border-gray-600 hover:text-gray-300">
      Sign out
    </button>
  )
}
