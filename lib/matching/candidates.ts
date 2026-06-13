import { cosineSimilarity } from './similarity'
import type { InterestVector } from './vector'

export type Candidate = {
  id: string
  interest_vector: InterestVector
  xp: number
  last_active: Date
}

const XP_TIERS = [0, 50, 150, 350, 700]

function getXpTier(xp: number): number {
  return XP_TIERS.reduce((tier, min, i) => (xp >= min ? i : tier), 0)
}

function xpTierProximity(xpA: number, xpB: number): number {
  const diff = Math.abs(getXpTier(xpA) - getXpTier(xpB))
  return Math.max(0, 1 - diff * 0.5)
}

function activityRecency(lastActive: Date): number {
  const daysSince = (Date.now() - lastActive.getTime()) / (1000 * 60 * 60 * 24)
  return Math.max(0, 1 - daysSince / 30)
}

export function scoreCandidate(user: Candidate, candidate: Candidate): number {
  const sim = cosineSimilarity(user.interest_vector, candidate.interest_vector)
  const xpProx = xpTierProximity(user.xp, candidate.xp)
  const recency = activityRecency(candidate.last_active)
  return sim * 0.6 + xpProx * 0.2 + recency * 0.2
}

export function rankCandidates(user: Candidate, candidates: Candidate[]): Candidate[] {
  return candidates
    .map(c => ({ candidate: c, score: scoreCandidate(user, c) }))
    .sort((a, b) => b.score - a.score)
    .map(({ candidate }) => candidate)
}
