'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import { Bell } from 'lucide-react'

export function NotifBell() {
  const pathname = usePathname()
  const [unread, setUnread] = useState(0)

  useEffect(() => {
    fetch('/api/notifications')
      .then(r => r.json())
      .then(d => setUnread(typeof d.unread === 'number' ? d.unread : 0))
      .catch(() => {})
  }, [pathname])

  return (
    <Link href="/notifications" aria-label="Notifications" className="relative text-ink-soft hover:text-ink transition-colors">
      <Bell size={20} />
      {unread > 0 && (
        <span className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-clay text-white text-[10px] font-semibold leading-4 text-center">
          {unread > 9 ? '9+' : unread}
        </span>
      )}
    </Link>
  )
}
