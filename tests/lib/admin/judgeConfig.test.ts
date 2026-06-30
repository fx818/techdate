import { describe, it, expect } from 'vitest'
import { parseJudgeConfigInput } from '@/lib/admin/judgeConfig'

describe('parseJudgeConfigInput', () => {
  it('accepts a full valid body', () => {
    const r = parseJudgeConfigInput({
      enabled: true, base_url: 'https://x/', model: 'gemini-2.5-flash',
      criteria: 'be good', pass_threshold: 7, api_key: 'AIzaSECRET',
    })
    expect(r.ok).toBe(true)
    if (r.ok) {
      expect(r.value.enabled).toBe(true)
      expect(r.value.pass_threshold).toBe(7)
      expect(r.value.api_key).toBe('AIzaSECRET')
    }
  })

  it('clamps pass_threshold above 10 down to 10', () => {
    const r = parseJudgeConfigInput({ enabled: false, pass_threshold: 99 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.pass_threshold).toBe(10)
  })

  it('clamps negative pass_threshold up to 0', () => {
    const r = parseJudgeConfigInput({ enabled: false, pass_threshold: -3 })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.pass_threshold).toBe(0)
  })

  it('treats a missing api_key as empty string (keep existing)', () => {
    const r = parseJudgeConfigInput({ enabled: true })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.api_key).toBe('')
  })

  it('coerces enabled to a boolean', () => {
    const r = parseJudgeConfigInput({ enabled: 'on' as unknown })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.value.enabled).toBe(true)
  })

  it('rejects a non-object body', () => {
    const r = parseJudgeConfigInput(null)
    expect(r.ok).toBe(false)
  })

  it('rejects a non-numeric pass_threshold', () => {
    const r = parseJudgeConfigInput({ enabled: true, pass_threshold: 'high' })
    expect(r.ok).toBe(false)
  })
})
