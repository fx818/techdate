import { describe, it, expect } from 'vitest'
import { cosineSimilarity } from '@/lib/matching/similarity'
import { scoreCandidate, rankCandidates, type Candidate } from '@/lib/matching/candidates'

describe('cosineSimilarity', () => {
  it('returns 1 for identical vectors', () => {
    const v = { AI: 0.7, DevOps: 0.3 }
    expect(cosineSimilarity(v, v)).toBeCloseTo(1)
  })

  it('returns 0 for completely different vectors', () => {
    expect(cosineSimilarity({ AI: 1 }, { DevOps: 1 })).toBeCloseTo(0)
  })

  it('returns 0 for empty vectors', () => {
    expect(cosineSimilarity({}, { AI: 1 })).toBe(0)
  })

  it('returns partial similarity for overlapping vectors', () => {
    const a = { AI: 0.8, DevOps: 0.2 }
    const b = { AI: 0.5, WebDev: 0.5 }
    const sim = cosineSimilarity(a, b)
    expect(sim).toBeGreaterThan(0)
    expect(sim).toBeLessThan(1)
  })
})

describe('scoreCandidate', () => {
  const baseUser = {
    id: 'u1',
    interest_vector: { AI: 0.7, DevOps: 0.3 },
    xp: 150,
    last_active: new Date(),
  }

  it('returns higher score for similar interest vector', () => {
    const similar = { id: 'u2', interest_vector: { AI: 0.8, DevOps: 0.2 }, xp: 120, last_active: new Date() }
    const different = { id: 'u3', interest_vector: { WebDev: 0.9, Mobile: 0.1 }, xp: 120, last_active: new Date() }
    expect(scoreCandidate(baseUser, similar)).toBeGreaterThan(scoreCandidate(baseUser, different))
  })

  it('penalizes stale profiles', () => {
    const recent = { id: 'u2', interest_vector: { AI: 0.7, DevOps: 0.3 }, xp: 150, last_active: new Date() }
    const stale = { id: 'u3', interest_vector: { AI: 0.7, DevOps: 0.3 }, xp: 150, last_active: new Date(Date.now() - 40 * 24 * 3600 * 1000) }
    expect(scoreCandidate(baseUser, recent)).toBeGreaterThan(scoreCandidate(baseUser, stale))
  })
})

describe('rankCandidates', () => {
  it('returns candidates sorted by score descending', () => {
    const user = { id: 'u0', interest_vector: { AI: 1 }, xp: 100, last_active: new Date() }
    const candidates: Candidate[] = [
      { id: 'low', interest_vector: { WebDev: 1 }, xp: 100, last_active: new Date() },
      { id: 'high', interest_vector: { AI: 0.9, DevOps: 0.1 }, xp: 100, last_active: new Date() },
    ]
    const ranked = rankCandidates(user, candidates)
    expect(ranked[0].id).toBe('high')
  })
})
