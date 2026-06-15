import Link from 'next/link'

// Lightweight header for logged-out visitors on public pages (e.g. a shared
// post). No profile/XP/nav — just the wordmark and auth entry points.
export function PublicHeader() {
  return (
    <header className="sticky top-0 z-30 bg-paper/95 backdrop-blur-md border-b border-line">
      <div className="max-w-xl mx-auto px-4 h-14 flex items-center justify-between">
        <Link href="/" className="font-display text-xl text-ink">Await</Link>
        <div className="flex items-center gap-2">
          <Link href="/login" className="btn btn-ghost text-sm px-3 py-1.5">Log in</Link>
          <Link href="/login" className="btn btn-primary text-sm px-3 py-1.5">Sign up</Link>
        </div>
      </div>
    </header>
  )
}
