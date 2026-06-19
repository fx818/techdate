'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X, SlidersHorizontal } from 'lucide-react'
import { GENRES } from '@/lib/genres'

type Source = 'all' | 'community' | 'gideon'
type Sort = 'latest' | 'top' | 'discussed'

export function FeedFilters({ userGenres }: { userGenres: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const genre = params.get('genre') ?? 'all'
  const source = (params.get('source') ?? 'all') as Source // 'all' (community + Gideon) is the default view
  const sort = (params.get('sort') ?? 'latest') as Sort
  const [q, setQ] = useState(params.get('q') ?? '')
  const [open, setOpen] = useState(false)
  const firstRender = useRef(true)

  const activeCount = (genre !== 'all' ? 1 : 0) + (source !== 'all' ? 1 : 0) + (sort !== 'latest' ? 1 : 0)

  function setParam(key: string, value: string, defaultValue: string) {
    const next = new URLSearchParams(params.toString())
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const t = setTimeout(() => setParam('q', q.trim(), ''), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const genreChips = [{ id: 'all', label: 'All topics' }, ...GENRES.filter(g => userGenres.includes(g.id))]

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input value={q} onChange={e => setQ(e.target.value)} placeholder="Search posts…" className="input pl-9 pr-9" />
          {q && (
            <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
              <X size={15} />
            </button>
          )}
        </div>
        <button onClick={() => setOpen(o => !o)}
          className={`btn relative shrink-0 ${open || activeCount > 0 ? 'btn-primary' : 'btn-ghost'}`}>
          <SlidersHorizontal size={16} />
          <span className="hidden sm:inline">Filters</span>
          {activeCount > 0 && (
            <span className="absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-clay-deep text-white text-[10px] font-semibold leading-[18px] text-center border border-surface">
              {activeCount}
            </span>
          )}
        </button>
      </div>

      {open && (
        <div className="space-y-3 pt-1 animate-rise">
          <div>
            <p className="text-ink-faint text-xs uppercase tracking-widest mb-1.5">Source</p>
            <div className="flex gap-1 p-1 rounded-xl bg-surface-sunk border border-line w-fit">
              {([['all', 'All'], ['community', 'Community'], ['gideon', 'Gideon']] as [Source, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setParam('source', val, 'all')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${source === val ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-ink-faint text-xs uppercase tracking-widest mb-1.5">Sort by</p>
            <div className="flex gap-1 p-1 rounded-xl bg-surface-sunk border border-line w-fit">
              {([['latest', 'Latest'], ['top', 'Most liked'], ['discussed', 'Most discussed']] as [Sort, string][]).map(([val, label]) => (
                <button key={val} onClick={() => setParam('sort', val, 'latest')}
                  className={`px-3 py-1 text-sm rounded-lg transition-colors ${sort === val ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'}`}>
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div>
            <p className="text-ink-faint text-xs uppercase tracking-widest mb-1.5">Topic</p>
            <div className="flex flex-wrap gap-2">
              {genreChips.map(g => (
                <button key={g.id} onClick={() => setParam('genre', g.id, 'all')}
                  className={`chip ${genre === g.id ? 'chip-on' : ''}`}>
                  {g.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
