// URL slug helpers. Page URLs use human-readable slugs; UUIDs stay only in
// the database and API routes. See docs/strategy/2026-06-15-pretty-url-slugs.md.

const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i
const UUID_EXACT = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

/** Lowercase, non-alphanumerics → hyphen, trimmed, capped. Always non-empty. */
export function slugify(input: string, max = 60): string {
  const s = (input || '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, max)
    .replace(/-+$/g, '')
  return s || 'item'
}

/** True if the string is exactly a UUID (used for legacy /…/<uuid> fallbacks). */
export function isUuid(s: string): boolean {
  return UUID_EXACT.test(s)
}

/** Onboarding/edit username rule: 3–20 chars, lowercase alphanumeric + underscore. */
export function isValidUsername(u: string): boolean {
  return /^[a-z0-9_]{3,20}$/.test(u)
}

/** Suggest a username from a display name (no uniqueness guarantee). */
export function suggestUsername(name: string): string {
  return (name || '').toLowerCase().replace(/[^a-z0-9_]+/g, '').slice(0, 20)
}

export function userHref(username?: string | null, fallbackId?: string): string {
  return `/users/${username ?? fallbackId ?? ''}`
}

export function postHref(slug?: string | null, fallbackId?: string): string {
  return `/posts/${slug ?? fallbackId ?? ''}`
}

/** Chat URL: <other person's handle>-<matchId>. Resolves by the trailing uuid. */
export function chatHref(otherLabel: string, matchId: string): string {
  return `/messages/${slugify(otherLabel, 20)}-${matchId}`
}

/** Extract the match UUID from a chat slug (or accept a bare uuid for legacy). */
export function matchIdFromSlug(slug: string): string {
  const m = slug.match(UUID_RE)
  return m ? m[0] : slug
}
