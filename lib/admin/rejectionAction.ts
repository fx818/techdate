// Validates the POST body for the reject-queue admin action. Pure (no Supabase)
// so it unit-tests without mocks.
export type RejectionAction = 'approve' | 'delete'

type Result =
  | { ok: true; action: RejectionAction }
  | { ok: false; error: string }

export function parseRejectionAction(body: unknown): Result {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be an object' }
  }
  const action = (body as Record<string, unknown>).action
  if (action === 'approve' || action === 'delete') {
    return { ok: true, action }
  }
  return { ok: false, error: "action must be 'approve' or 'delete'" }
}
