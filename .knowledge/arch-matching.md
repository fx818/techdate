---
type: architecture
title: Matching
description: interest_vector + cosine similarity candidate scoring
tags: [matching, candidates, interest-vector, cosine]
timestamp: 2026-06-18T00:00:00Z
---

# Matching

Ranks who appears in Discover. Code in `lib/matching/`; served by `app/api/candidates`.

- **interest_vector:** each user has `interest_vector: Record<string, number>` on their `users` row. Seeded at onboarding from genre choices (`lib/matching/vector.ts::seedVector`), updated on every like/comment/post via `updateVector` then `normalizeVector` (always sums to 1.0).
- **Candidate scoring** (`lib/matching/candidates.ts::scoreCandidate`): cosine similarity of interest vectors weighted **60% similarity + 20% XP-tier proximity + 20% activity recency**.
- No gender/`preference` filtering in candidate selection (dropped — the `preference` column still exists, default `everyone`, but is unused). See [peers](arch-peers.md) for the connection flow that consumes this ranking.
- Tests: `tests/lib/matching/`.
