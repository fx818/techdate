'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useEffect, useState } from 'react'
import { Rss, Heart, Sparkles, MessageSquare, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/feed', icon: Rss, label: 'Feed' },
  { href: '/discover', icon: Heart, label: 'Discover' },
  { href: '/requests', icon: Sparkles, label: 'Requests' },
  { href: '/matches', icon: MessageSquare, label: 'Matches' },
  { href: '/profile', icon: User, label: 'Profile' },
]

export function Navbar() {
  const pathname = usePathname()
  const [requestCount, setRequestCount] = useState(0)

  // Refresh the pending-request count on every navigation (cheap, keeps the
  // badge in sync after you accept/decline on the Requests page).
  useEffect(() => {
    fetch('/api/requests')
      .then(r => r.json())
      .then(d => setRequestCount(Array.isArray(d.received) ? d.received.length : 0))
      .catch(() => {})
  }, [pathname])

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 border-t border-line bg-surface/90 backdrop-blur-md">
      <div className="max-w-xl mx-auto flex px-2">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          const badge = href === '/requests' && requestCount > 0
          return (
            <Link key={href} href={href}
              className="flex-1 flex flex-col items-center gap-1 py-2.5 text-xs">
              <span className={`relative flex items-center justify-center rounded-full px-3.5 py-1 transition-colors ${
                active ? 'bg-clay-tint text-clay-deep' : 'text-ink-faint'
              }`}>
                <Icon size={20} strokeWidth={active ? 2.4 : 2} />
                {badge && (
                  <span className="absolute -top-0.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-clay text-white text-[10px] font-semibold leading-4 text-center">
                    {requestCount > 9 ? '9+' : requestCount}
                  </span>
                )}
              </span>
              <span className={active ? 'text-ink font-medium' : 'text-ink-faint'}>{label}</span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
