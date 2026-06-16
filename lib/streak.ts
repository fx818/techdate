// The stored `streak_count` is only refreshed when a user next visits (the
// /api/streak endpoint resets or extends it). Until then a broken streak still
// shows its old value. `effectiveStreak` corrects this at display time: a streak
// is only "alive" if the last login was today or yesterday (IST — matching the
// streak endpoint's day boundary). Otherwise it reads as 0. Display-only; it does
// not mutate the stored value.
function istDate(d: Date) {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Kolkata' }).format(d)
}

export function effectiveStreak(
  streakCount: number | null | undefined,
  lastLoginDate: string | null | undefined
): number {
  const streak = streakCount ?? 0
  if (streak === 0 || !lastLoginDate) return 0
  const today = istDate(new Date())
  const yesterday = istDate(new Date(Date.now() - 86400000))
  return lastLoginDate === today || lastLoginDate === yesterday ? streak : 0
}
