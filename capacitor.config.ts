// The shell loads the deployed Next.js site. Default is the current Vercel prod
// URL; override per-build with CAP_SERVER_URL=https://... npx cap sync android
// if the deploy moves to a custom domain.
//
// NOTE: the PWA service worker (Serwist, see next.config.ts) is served from and
// scoped to THIS origin. If the deploy moves to a new domain, also update the
// Supabase preconnect hint in app/layout.tsx — otherwise the WebView loads the
// new origin with no cached shell and the preconnect points at nothing.

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.await.com',
  appName: 'Await',
  // webDir is unused in server.url mode but is required by the Capacitor schema.
  webDir: 'public',
  // Warm-paper background so the launch frame is never black (matches the splash).
  backgroundColor: '#f4f2eaff',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://techdate-eta.vercel.app',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      // Held until the web app calls hide() (see components/AwaitSplash.tsx),
      // so the cream splash covers the whole remote-load gap. Cream, no spinner.
      launchAutoHide: false,
      backgroundColor: '#f4f2ea',
      showSpinner: false,
      androidSplashResourceName: 'splash',
      splashFullScreen: true,
      splashImmersive: false,
    },
  },
}

export default config
