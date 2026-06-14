const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.in', 'yahoo.co.in',
  'hotmail.com', 'hotmail.in',
  'outlook.com', 'outlook.in',
  'live.com', 'live.in',
  'rediffmail.com',
  'protonmail.com', 'pm.me',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
])

export function isPersonalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase() ?? ''
  return PERSONAL_DOMAINS.has(domain)
}

export function trialDaysLeft(createdAt: string): number {
  const trialEnd = new Date(new Date(createdAt).getTime() + 7 * 24 * 60 * 60 * 1000)
  return Math.max(0, Math.ceil((trialEnd.getTime() - Date.now()) / (24 * 60 * 60 * 1000)))
}
