import { describe, it, expect } from 'vitest'
import { parseRejectionAction } from '@/lib/admin/rejectionAction'

describe('parseRejectionAction', () => {
  it('accepts approve', () => {
    const r = parseRejectionAction({ action: 'approve' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.action).toBe('approve')
  })

  it('accepts delete', () => {
    const r = parseRejectionAction({ action: 'delete' })
    expect(r.ok).toBe(true)
    if (r.ok) expect(r.action).toBe('delete')
  })

  it('rejects an unknown action', () => {
    const r = parseRejectionAction({ action: 'nuke' })
    expect(r.ok).toBe(false)
  })

  it('rejects a missing action', () => {
    const r = parseRejectionAction({})
    expect(r.ok).toBe(false)
  })

  it('rejects a non-object body', () => {
    const r = parseRejectionAction(null)
    expect(r.ok).toBe(false)
  })
})
