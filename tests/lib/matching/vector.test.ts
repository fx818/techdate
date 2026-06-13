import { describe, it, expect } from 'vitest'
import { seedVector, updateVector, normalizeVector } from '@/lib/matching/vector'

describe('seedVector', () => {
  it('distributes equal weight across genres', () => {
    const v = seedVector(['AI', 'DevOps'])
    expect(v['AI']).toBeCloseTo(0.5)
    expect(v['DevOps']).toBeCloseTo(0.5)
  })

  it('weights sum to 1', () => {
    const v = seedVector(['AI', 'DevOps', 'WebDev'])
    const sum = Object.values(v).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
  })
})

describe('updateVector', () => {
  it('increments genre weight and re-normalizes', () => {
    const v = seedVector(['AI', 'DevOps'])
    const updated = updateVector(v, 'AI', 0.2)
    const sum = Object.values(updated).reduce((a, b) => a + b, 0)
    expect(sum).toBeCloseTo(1)
    expect(updated['AI']).toBeGreaterThan(v['AI'])
  })

  it('adds new genre if not present', () => {
    const v = seedVector(['AI'])
    const updated = updateVector(v, 'WebDev', 0.1)
    expect(updated['WebDev']).toBeDefined()
  })
})

describe('normalizeVector', () => {
  it('returns empty object unchanged', () => {
    expect(normalizeVector({})).toEqual({})
  })
})
