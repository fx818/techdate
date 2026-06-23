// TODO: set CAP_SERVER_URL to your public deploy URL (e.g. Vercel) before building.
// Example: CAP_SERVER_URL=https://tech-date.vercel.app npx cap sync

import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.anurag.techdate',
  appName: 'techDate',
  // webDir is unused in server.url mode but is required by the Capacitor schema.
  webDir: 'public',
  server: {
    url: process.env.CAP_SERVER_URL || 'https://REPLACE_WITH_YOUR_DEPLOY_URL',
    cleartext: false,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
  },
}

export default config
