'use client'

import { useEffect } from 'react'

// Clears the unread badge once the notifications page has been opened.
export function MarkNotificationsSeen() {
  useEffect(() => {
    fetch('/api/notifications/seen', { method: 'POST' }).catch(() => {})
  }, [])
  return null
}
