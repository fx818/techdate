import { Redis } from '@upstash/redis'

let _redis: Redis | null = null

function getRedis(): Redis {
  if (!_redis) {
    _redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL!,
      token: process.env.UPSTASH_REDIS_REST_TOKEN!,
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
