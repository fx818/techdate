const TIERS = [
  { min: 0, label: 'Explorer', color: 'text-ink-soft bg-surface-sunk' },
  { min: 100, label: 'Builder', color: 'text-sage bg-sage-tint' },
  { min: 350, label: 'Architect', color: 'text-clay-deep bg-clay-tint' },
  { min: 700, label: 'Principal', color: 'text-white bg-clay' },
]

export function XpBadge({ xp }: { xp: number }) {
  const tier = [...TIERS].reverse().find(t => xp >= t.min) ?? TIERS[0]
  return (
    <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${tier.color}`}>
      {tier.label} · <span className="font-mono">{xp}</span> XP
    </span>
  )
}
