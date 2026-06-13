import { describe, it, expect } from 'vitest'
import { XP_WEIGHTS, DATING_UNLOCK_THRESHOLD } from '@/lib/xp/weights'

describe('XP_WEIGHTS', () => {
  it('has correct value for like', () => {
    expect(XP_WEIGHTS.like).toBe(2)
  })
  it('has correct value for post', () => {
    expect(XP_WEIGHTS.post).toBe(25)
  })
  it('has correct value for comment', () => {
    expect(XP_WEIGHTS.comment).toBe(10)
  })
  it('has correct value for reply', () => {
    expect(XP_WEIGHTS.reply).toBe(5)
  })
  it('has correct value for profile_complete', () => {
    expect(XP_WEIGHTS.profile_complete).toBe(20)
  })
  it('has correct value for login_streak', () => {
    expect(XP_WEIGHTS.login_streak).toBe(3)
  })
  it('DATING_UNLOCK_THRESHOLD is 100', () => {
    expect(DATING_UNLOCK_THRESHOLD).toBe(100)
  })
})
