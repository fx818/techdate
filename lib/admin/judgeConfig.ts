// Validates/normalizes the POST body for the Gideon judge admin form before it
// reaches the gideon_judge_config_save RPC. Pure (no Supabase) so it unit-tests
// without mocks. A blank api_key is intentional — the RPC keeps the existing key.
export type JudgeConfigInput = {
  enabled: boolean
  base_url: string
  model: string
  criteria: string
  pass_threshold: number
  api_key: string
}

type Result =
  | { ok: true; value: JudgeConfigInput }
  | { ok: false; error: string }

export function parseJudgeConfigInput(body: unknown): Result {
  if (typeof body !== 'object' || body === null) {
    return { ok: false, error: 'Body must be an object' }
  }
  const b = body as Record<string, unknown>

  // pass_threshold: required to be numeric when present; clamp to 0..10.
  let threshold = 6
  if (b.pass_threshold !== undefined && b.pass_threshold !== null) {
    const n = Number(b.pass_threshold)
    if (!Number.isFinite(n)) return { ok: false, error: 'pass_threshold must be a number' }
    threshold = Math.max(0, Math.min(10, Math.round(n)))
  }

  return {
    ok: true,
    value: {
      enabled: Boolean(b.enabled),
      base_url: typeof b.base_url === 'string' ? b.base_url.trim() : '',
      model: typeof b.model === 'string' ? b.model.trim() : '',
      criteria: typeof b.criteria === 'string' ? b.criteria : '',
      pass_threshold: threshold,
      api_key: typeof b.api_key === 'string' ? b.api_key.trim() : '',
    },
  }
}
