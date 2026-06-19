import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

// Strip any stray BOM / whitespace that can sneak into env values when they
// are set through shells that re-encode stdin (this exact bug bit us on Vercel).
function clean(v: string | undefined): string {
  return (v ?? '').replace(/^﻿/, '').trim()
}

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: clean(process.env.UPSTASH_REDIS_REST_URL),
      token: clean(process.env.UPSTASH_REDIS_REST_TOKEN),
    })
  }
  return _redis
}

export async function getDailySwipeCount(userId: string): Promise<number> {
  const key = `swipes:${userId}:${new Date().toISOString().slice(0, 10)}`
  const count = await getRedis().get<number>(key)
  return count ?? 0
}

export async function incrementDailySwipeCount(userId: string): Promise<number> {
  const key = `swipes:${userId}:${new Date().toISOString().slice(0, 10)}`
  const redis = getRedis()
  const count = await redis.incr(key)
  await redis.expire(key, 86400)
  return count
}

// Generic fixed-window rate limiter for write actions (posts, comments, messages,
// reports). Best-effort: if Redis is unavailable, degrade OPEN (allow the action)
// rather than block a real user over an infra hiccup — same policy as the swipe cap.
// Returns true if the action is allowed, false if the limit is exceeded.
export async function rateLimit(
  action: string,
  userId: string,
  limit: number,
  windowSec: number,
): Promise<boolean> {
  try {
    const redis = getRedis()
    const key = `rl:${action}:${userId}`
    const count = await redis.incr(key)
    if (count === 1) await redis.expire(key, windowSec)
    return count <= limit
  } catch (e) {
    console.error(`rate limit check failed for ${action} (allowing):`, e)
    return true
  }
}
