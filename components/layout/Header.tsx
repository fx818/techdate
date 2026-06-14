import Link from 'next/link'
import { NotifBell } from './NotifBell'

export function Header({
  name,
  photoUrl,
  xp,
  streak,
}: {
  name: string
  photoUrl: string | null
  xp: number
  streak: number
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="max-w-xl mx-auto flex items-center justify-between px-4 h-14">
        <Link href="/feed" className="font-display text-2xl text-ink leading-none">
          Await<span className="text-clay-deep">.</span>
        </Link>

        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5 text-sm bg-clay-tint text-clay-deep rounded-full px-2.5 py-1">
            {streak > 0 && <span title={`${streak}-day streak`}>🔥<span className="font-mono ml-0.5">{streak}</span></span>}
            <span className="font-mono">{xp}</span> XP
          </span>

          <NotifBell />

          <Link href="/profile" aria-label="Your profile"
            className="w-9 h-9 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep font-display overflow-hidden border border-line hover:border-clay transition-colors">
            {photoUrl
              ? <img src={photoUrl} alt={name} className="w-9 h-9 object-cover" />
              : (name?.[0]?.toUpperCase() ?? '·')}
          </Link>
        </div>
      </div>
    </header>
  )
}
