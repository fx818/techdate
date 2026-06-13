import type { InterestVector } from './vector'

export function cosineSimilarity(a: InterestVector, b: InterestVector): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  let dot = 0, magA = 0, magB = 0
  for (const k of keys) {
    const va = a[k] ?? 0
    const vb = b[k] ?? 0
    dot += va * vb
    magA += va * va
    magB += vb * vb
  }
  if (magA === 0 || magB === 0) return 0
  return dot / (Math.sqrt(magA) * Math.sqrt(magB))
}
