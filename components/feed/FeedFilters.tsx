'use client'

import { useEffect, useState, useRef } from 'react'
import { useRouter, useSearchParams, usePathname } from 'next/navigation'
import { Search, X } from 'lucide-react'
import { GENRES } from '@/lib/genres'

type Source = 'all' | 'community' | 'gideon'
type Sort = 'latest' | 'top' | 'discussed'

export function FeedFilters({ userGenres }: { userGenres: string[] }) {
  const router = useRouter()
  const pathname = usePathname()
  const params = useSearchParams()

  const genre = params.get('genre') ?? 'all'
  const source = (params.get('source') ?? 'all') as Source
  const sort = (params.get('sort') ?? 'latest') as Sort
  const [q, setQ] = useState(params.get('q') ?? '')
  const firstRender = useRef(true)

  // Push a single param change to the URL (server re-renders the feed).
  function setParam(key: string, value: string, defaultValue: string) {
    const next = new URLSearchParams(params.toString())
    if (value === defaultValue) next.delete(key)
    else next.set(key, value)
    router.replace(`${pathname}?${next.toString()}`, { scroll: false })
  }

  // Debounced search.
  useEffect(() => {
    if (firstRender.current) { firstRender.current = false; return }
    const t = setTimeout(() => setParam('q', q.trim(), ''), 350)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q])

  const genreChips = [{ id: 'all', label: 'All topics' }, ...GENRES.filter(g => userGenres.includes(g.id))]

  return (
    <div className="space-y-3">
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
        <input
          value={q}
          onChange={e => setQ(e.target.value)}
          placeholder="Search posts…"
          className="input pl-9 pr-9"
        />
        {q && (
          <button onClick={() => setQ('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-faint hover:text-ink">
            <X size={15} />
          </button>
        )}
      </div>

      {/* Source + Sort */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-1 p-1 rounded-xl bg-surface-sunk border border-line">
          {([['all', 'All'], ['community', 'Community'], ['gideon', 'Gideon']] as [Source, string][]).map(([val, label]) => (
            <button key={val} onClick={() => setParam('source', val, 'all')}
              className={`px-3 py-1 text-sm rounded-lg transition-colors ${source === val ? 'bg-surface text-ink shadow-sm' : 'text-ink-faint'}`}>
              {label}
            </button>
          ))}
        </div>
        <select value={sort} onChange={e => setParam('sort', e.target.value, 'latest')}
          className="input w-auto py-1.5 text-sm">
          <option value="latest">Latest</option>
          <option value="top">Most liked</option>
          <option value="discussed">Most discussed</option>
        </select>
      </div>

      {/* Genre chips */}
      <div className="flex flex-wrap gap-2">
        {genreChips.map(g => (
          <button key={g.id} onClick={() => setParam('genre', g.id, 'all')}
            className={`chip ${genre === g.id ? 'chip-on' : ''}`}>
            {g.label}
          </button>
        ))}
      </div>
    </div>
  )
}
