'use client'

import { useEffect } from 'react'

// The current day in IST — matches the streak endpoint's day boundary so the
// client guard and the server agree on when "a new day" starts.
function istToday() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(new Date())
}

// Fires the daily login-streak + last-active bump. Guarded per IST calendar day
// (not per browser session) and re-checked whenever the tab regains focus, so a
// long-open tab still counts the new day after midnight. The endpoint is
// idempotent per day, so an extra call is harmless.
export function StreakPing() {
  useEffect(() => {
    function ping() {
      if (document.visibilityState !== 'visible') return
      const key = `streak_pinged_${istToday()}`
      if (localStorage.getItem(key)) return
      localStorage.setItem(key, '1')
      fetch('/api/streak', { method: 'POST' }).catch(() => {})
      fetch('/api/active', { method: 'POST' }).catch(() => {})
    }

    ping()
    document.addEventListener('visibilitychange', ping)
    window.addEventListener('focus', ping)
    return () => {
      document.removeEventListener('visibilitychange', ping)
      window.removeEventListener('focus', ping)
    }
  }, [])

  return null
}
