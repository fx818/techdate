// Free / personal email providers. A user on one of these must verify a
// company email after the trial window; a user who signed up with a domain
// NOT in this list is treated as already on a company email (no verification).
const PERSONAL_DOMAINS = new Set([
  'gmail.com', 'googlemail.com',
  'yahoo.com', 'yahoo.in', 'yahoo.co.in', 'ymail.com', 'rocketmail.com',
  'hotmail.com', 'hotmail.in', 'hotmail.co.uk',
  'outlook.com', 'outlook.in',
  'live.com', 'live.in',
  'msn.com',
  'rediffmail.com',
  'protonmail.com', 'proton.me', 'pm.me',
  'icloud.com', 'me.com', 'mac.com',
  'aol.com',
  'mail.com', 'gmx.com', 'gmx.net',
  'yandex.com', 'yandex.ru',
  'zoho.com',
  'tutanota.com',
  'hey.com',
])

export function isPersonalEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim() ?? ''
  return PERSONAL_DOMAINS.has(domain)
}

// Trial window before a personal-email user must verify a company email.
const TRIAL_MS = 24 * 60 * 60 * 1000 // 24 hours

export function isTrialExpired(createdAt: string): boolean {
  return Date.now() - new Date(createdAt).getTime() >= TRIAL_MS
}

export function trialHoursLeft(createdAt: string): number {
  const end = new Date(createdAt).getTime() + TRIAL_MS
  return Math.max(0, Math.ceil((end - Date.now()) / (60 * 60 * 1000)))
}
