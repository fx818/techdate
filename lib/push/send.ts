import { createAdminClient } from '@/lib/supabase/admin'
import { sendFcmMessage } from '@/lib/push/fcm'

export async function sendPush(
  userId: string,
  payload: { title: string; body: string; route?: string }
): Promise<void> {
  try {
    const admin = createAdminClient()

    const { data: rows, error } = await (admin as any)
      .from('device_tokens')
      .select('token')
      .eq('user_id', userId)

    if (error || !rows || rows.length === 0) return

    const data = payload.route ? { route: payload.route } : undefined

    await Promise.all(
      rows.map(async (row: { token: string }) => {
        const result = await sendFcmMessage(row.token, {
          title: payload.title,
          body: payload.body,
          data,
        })

        if (result.invalidToken) {
          await (admin as any)
            .from('device_tokens')
            .delete()
            .eq('user_id', userId)
            .eq('token', row.token)
        }
      })
    )
  } catch {
    // best-effort: never throw to caller
  }
}
