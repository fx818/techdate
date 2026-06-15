import { promises as dns } from 'dns'

// Server-only: verify a domain can actually receive email. Checks MX records,
// falling back to an A/AAAA record (RFC 5321 allows mail to the A record when
// no MX exists) so we don't reject small company domains that lack explicit MX.
export async function domainHasMx(domain: string): Promise<boolean> {
  const d = (domain || '').trim().toLowerCase()
  if (!d || !d.includes('.')) return false
  try {
    const mx = await dns.resolveMx(d)
    if (mx && mx.some(r => r.exchange)) return true
  } catch {
    // no MX / NXDOMAIN — fall through to A-record check
  }
  try {
    const a = await dns.resolve(d)
    return a.length > 0
  } catch {
    return false
  }
}
