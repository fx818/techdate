import Link from 'next/link'

export function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-line bg-surface/85 backdrop-blur-md">
      <div className="max-w-xl mx-auto flex items-center justify-between px-4 h-14">
        <Link href="/feed" className="font-display text-2xl text-ink leading-none">
          Await<span className="text-clay-deep">.</span>
        </Link>
        <span className="text-ink-faint text-xs font-mono hidden sm:block">worth the await</span>
      </div>
    </header>
  )
}
