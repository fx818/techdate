import disposableDomains from 'disposable-email-domains'

// Server-only: a large blocklist (~120k) of known disposable / temp-mail domains
// (mailinator, guerrillamail, 10minutemail, …). Keep this off the client bundle —
// import it only in server routes / server components.
const DISPOSABLE = new Set(disposableDomains.map(d => d.toLowerCase()))

export function isDisposableEmail(email: string): boolean {
  const domain = email.split('@')[1]?.toLowerCase().trim() ?? ''
  return DISPOSABLE.has(domain)
}
