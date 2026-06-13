import { createClient } from '@/lib/supabase/server'
import { XP_WEIGHTS, DATING_UNLOCK_THRESHOLD } from './weights'
import type { XpAction } from '@/lib/supabase/types'

export async function awardXp(userId: string, action: XpAction) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any
  const xpAmount = XP_WEIGHTS[action]

  await supabase.from('xp_events').insert({
    user_id: userId,
    action,
    xp_awarded: xpAmount,
  })

  const { data: user } = await supabase
    .from('users')
    .select('xp, dating_unlocked')
    .eq('id', userId)
    .single()

  if (!user) return

  const newXp = (user.xp as number) + xpAmount
  const shouldUnlock = !(user.dating_unlocked as boolean) && newXp >= DATING_UNLOCK_THRESHOLD

  await supabase
    .from('users')
    .update({
      xp: newXp,
      ...(shouldUnlock ? { dating_unlocked: true } : {}),
    })
    .eq('id', userId)

  return { newXp, unlocked: shouldUnlock }
}
