'use client'

import { useEffect } from 'react'

// Fires the daily login-streak award once per browser session. The endpoint
// itself is idempotent per calendar day, so this is just to avoid spamming it
// on every client navigation.
export function StreakPing() {
  useEffect(() => {
    if (sessionStorage.getItem('streak_pinged')) return
    sessionStorage.setItem('streak_pinged', '1')
    fetch('/api/streak', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
