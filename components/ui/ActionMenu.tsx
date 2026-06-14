'use client'
import { useState, useRef, useEffect } from 'react'
import { MoreHorizontal } from 'lucide-react'

export interface MenuItem { label: string; onClick: () => void; danger?: boolean }

export function ActionMenu({ items, label = 'More actions' }: { items: MenuItem[]; label?: string }) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function onDoc(e: MouseEvent) { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [])
  return (
    <div ref={ref} className="relative">
      <button aria-label={label} onClick={() => setOpen(o => !o)} className="text-ink-faint hover:text-ink p-1">
        <MoreHorizontal size={18} />
      </button>
      {open && (
        <div className="absolute right-0 top-8 z-40 w-44 card p-1 shadow-lg">
          {items.map((it, i) => (
            <button key={i} onClick={() => { setOpen(false); it.onClick() }}
              className={`w-full text-left text-sm px-3 py-2 rounded-lg hover:bg-surface-sunk ${it.danger ? 'text-clay-deep' : 'text-ink'}`}>
              {it.label}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
