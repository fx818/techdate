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
