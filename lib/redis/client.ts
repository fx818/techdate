import { Redis } from '@upstash/redis'

export const redis = Redis.fromEnv()

export async function getDailySwipeCount(userId: string): Promise<number> {
  const key = `swipes:${userId}:${new Date().toISOString().slice(0, 10)}`
  const count = await redis.get<number>(key)
  return count ?? 0
}

export async function incrementDailySwipeCount(userId: string): Promise<number> {
  const key = `swipes:${userId}:${new Date().toISOString().slice(0, 10)}`
  const count = await redis.incr(key)
  // Expire key at midnight (86400 seconds)
  await redis.expire(key, 86400)
  return count
}
