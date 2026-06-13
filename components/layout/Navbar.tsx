'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Rss, Heart, MessageSquare, User } from 'lucide-react'

const NAV_ITEMS = [
  { href: '/feed', icon: Rss, label: 'Feed' },
  { href: '/discover', icon: Heart, label: 'Discover' },
  { href: '/matches', icon: MessageSquare, label: 'Matches' },
  { href: '/profile', icon: User, label: 'Profile' },
]

export function Navbar() {
  const pathname = usePathname()

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-gray-950 border-t border-gray-800 z-40">
      <div className="max-w-xl mx-auto flex">
        {NAV_ITEMS.map(({ href, icon: Icon, label }) => {
          const active = pathname === href || pathname.startsWith(href + '/')
          return (
            <Link key={href} href={href}
              className={`flex-1 flex flex-col items-center py-3 gap-0.5 text-xs ${
                active ? 'text-indigo-400' : 'text-gray-500 hover:text-gray-300'
              }`}>
              <Icon size={20} />
              {label}
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
