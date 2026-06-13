const TIERS = [
  { min: 0, label: 'Explorer', color: 'text-gray-400 bg-gray-800' },
  { min: 100, label: 'Builder', color: 'text-green-400 bg-green-900/40' },
  { min: 350, label: 'Architect', color: 'text-blue-400 bg-blue-900/40' },
  { min: 700, label: 'Principal', color: 'text-purple-400 bg-purple-900/40' },
]

export function XpBadge({ xp }: { xp: number }) {
  const tier = [...TIERS].reverse().find(t => xp >= t.min) ?? TIERS[0]
  return (
    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${tier.color}`}>
      {tier.label} · {xp} XP
    </span>
  )
}
