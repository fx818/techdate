'use client'

import { useEffect } from 'react'

/**
 * Mounts inside the authenticated shell only when running inside the Capacitor
 * Android wrapper.  Requests FCM permission, registers the device token via
 * POST /api/devices (same-origin cookie auth), and wires up deep-link routing
 * when the user taps a notification.
 *
 * Dynamic imports keep @capacitor/push-notifications out of web/SSR bundles.
 * All errors are swallowed — push registration must never crash the web app.
 */
export default function PushRegistrar() {
  useEffect(() => {
    const listenerHandles: Array<{ remove: () => void }> = []

    async function init() {
      try {
        const { Capacitor } = await import('@capacitor/core')
        if (!Capacitor.isNativePlatform()) return

        const { PushNotifications } = await import('@capacitor/push-notifications')

        const permResult = await PushNotifications.requestPermissions()
        if (permResult.receive !== 'granted') return

        await PushNotifications.register()

        const regHandle = await PushNotifications.addListener(
          'registration',
          (token) => {
            fetch('/api/devices', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ token: token.value, platform: 'android' }),
            }).catch(() => {
              // best-effort — ignore network errors
            })
          },
        )
        listenerHandles.push(regHandle)

        const actionHandle = await PushNotifications.addListener(
          'pushNotificationActionPerformed',
          (action) => {
            const route: string | undefined = action.notification.data?.route
            if (route) {
              window.location.assign(route)
            }
          },
        )
        listenerHandles.push(actionHandle)
      } catch {
        // never throw — push is best-effort
      }
    }

    init()

    return () => {
      for (const handle of listenerHandles) {
        try {
          handle.remove()
        } catch {
          // ignore cleanup errors
        }
      }
    }
  }, [])

  return null
}
