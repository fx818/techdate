'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/**
 * Keeps the Supabase session alive while the app is open.
 *
 * Server-rendered pages don't instantiate a browser Supabase client, so without
 * this nothing runs the client-side auto-refresh timer — the 1-hour access token
 * ages out during idle and subsequent (soft) navigations silently fail because a
 * token rotated during a Server Component render can't be written back to cookies.
 *
 * Mounting one long-lived client here:
 *  - runs auto-refresh for the whole session,
 *  - re-syncs Server Components (router.refresh) whenever the token rotates,
 *  - sends the user to /login the moment the session is truly gone,
 *  - and re-validates on tab focus, in case the refresh timer was throttled while
 *    the tab was backgrounded.
 */
export function SessionWatcher() {
  const router = useRouter()
  // createBrowserClient is internally memoised, but pin the instance per-mount.
  const [supabase] = useState(() => createClient())

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      // A failed refresh (dead/rotated refresh token) emits SIGNED_OUT — that's the
      // reliable "session is gone" signal. Don't redirect on a transient null
      // INITIAL_SESSION, which can fire before the client hydrates from cookies.
      if (event === 'SIGNED_OUT') {
        router.replace('/login')
      } else if (event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN') {
        // New cookies were written client-side; let the server re-read them.
        router.refresh()
      }
    })
    return () => subscription.unsubscribe()
  }, [supabase, router])

  useEffect(() => {
    async function revalidate() {
      if (document.visibilityState !== 'visible') return
      // getSession() refreshes if the token is expired and a refresh token exists.
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) router.replace('/login')
    }
    document.addEventListener('visibilitychange', revalidate)
    return () => document.removeEventListener('visibilitychange', revalidate)
  }, [supabase, router])

  return null
}
