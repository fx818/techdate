export function activeLabel(iso: string | null): string | null {
  if (!iso) return null
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60000)
  if (mins < 15) return 'Active now'
  if (mins < 60) return 'Active recently'
  if (mins < 1440) return `Active ${Math.floor(mins / 60)}h ago`
  const d = Math.floor(mins / 1440)
  return d <= 7 ? `Active ${d}d ago` : null
}
