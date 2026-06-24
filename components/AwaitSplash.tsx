'use client'

import { useEffect, useState } from 'react'

/**
 * Branded startup splash. Server-rendered so it paints with the first HTML
 * (covers the blank/black gap while the remote app loads in the Capacitor
 * WebView). The "Await." wordmark does a calm fade-in + rise, then the whole
 * overlay fades out once the app is ready.
 *
 * On native it also hides the held native splash (cream → cream handoff) so
 * there's no flash. On the web it fades almost immediately — just a faint
 * brand beat, no real delay.
 */
export default function AwaitSplash() {
  const [leaving, setLeaving] = useState(false)
  const [gone, setGone] = useState(false)

  useEffect(() => {
    let holdMs = 350 // web: brief brand beat
    let cancelled = false

    ;(async () => {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (Capacitor.isNativePlatform()) {
          holdMs = 1100 // native: let the animation play
          // Hand off from the held native splash to this (already-painted) overlay.
          const { SplashScreen } = await import('@capacitor/splash-screen')
          await SplashScreen.hide({ fadeOutDuration: 200 })
        }
      } catch {
        // not in Capacitor / plugin missing — web path, fine
      }
      if (cancelled) return
      window.setTimeout(() => !cancelled && setLeaving(true), holdMs)
    })()

    return () => { cancelled = true }
  }, [])

  if (gone) return null

  return (
    <div
      className={`await-splash${leaving ? ' await-splash--out' : ''}`}
      aria-hidden="true"
      onTransitionEnd={() => leaving && setGone(true)}
    >
      <div className="await-splash__mark">
        Await<span className="await-splash__dot">.</span>
      </div>
    </div>
  )
}
