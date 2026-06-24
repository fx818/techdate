// The shell loads the deployed Next.js site. Default is the current Vercel prod
// URL; override per-build with CAP_SERVER_URL=https://... npx cap sync android
// if the deploy moves to a custom domain.

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.anurag.techdate',
  appName: 'techDate',
  // webDir is unused in server.url mode but is required by the Capacitor schema.
  webDir: 'public',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://techdate-eta.vercel.app',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
