export type InterestVector = Record<string, number>

export function seedVector(genres: string[]): InterestVector {
  if (genres.length === 0) return {}
  const weight = 1 / genres.length
  return Object.fromEntries(genres.map(g => [g, weight]))
}

export function updateVector(
  vector: InterestVector,
  genre: string,
  increment: number = 0.1
): InterestVector {
  const updated = { ...vector, [genre]: (vector[genre] ?? 0) + increment }
  return normalizeVector(updated)
}

export function normalizeVector(vector: InterestVector): InterestVector {
  const total = Object.values(vector).reduce((sum, v) => sum + v, 0)
  if (total === 0) return vector
  return Object.fromEntries(
    Object.entries(vector).map(([k, v]) => [k, v / total])
  )
}
