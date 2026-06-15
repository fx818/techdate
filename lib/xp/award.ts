import { createClient } from '@/lib/supabase/server'
import { XP_WEIGHTS } from './weights'
import type { XpAction } from '@/lib/supabase/types'

// One atomic RPC (insert xp_event + bump users.xp + flip dating_unlocked) instead
// of the old 3 sequential round-trips. Pass an existing client (e.g. from inside
// `after()`) to reuse the request's auth context.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function awardXp(_userId: string, action: XpAction, client?: any) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (client ?? (await createClient())) as any
  const xpAmount = XP_WEIGHTS[action]
  const { data: newXp } = await supabase.rpc('award_xp', { p_action: action, p_xp: xpAmount })
  return { newXp }
}
