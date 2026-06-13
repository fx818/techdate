import type { XpAction } from '@/lib/supabase/types'

export const XP_WEIGHTS: Record<XpAction, number> = {
  like: 2,
  comment: 10,
  reply: 5,
  post: 25,
  profile_complete: 20,
  login_streak: 3,
}

export const DATING_UNLOCK_THRESHOLD = 100
