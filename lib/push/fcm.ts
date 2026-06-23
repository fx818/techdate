import { createSign } from 'node:crypto'

interface AccessTokenCache {
  token: string
  expiresAt: number
}

let _tokenCache: AccessTokenCache | null = null
let _tokenFetcherOverride: (() => Promise<string>) | null = null

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf8') : input
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function getAccessToken(): Promise<string> {
  if (_tokenFetcherOverride) return _tokenFetcherOverride()

  const now = Math.floor(Date.now() / 1000)

  if (_tokenCache && _tokenCache.expiresAt > now + 60) {
    return _tokenCache.token
  }

  const clientEmail = process.env.FCM_CLIENT_EMAIL!
  const privateKey = process.env.FCM_PRIVATE_KEY!.replace(/\\n/g, '\n')

  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = base64url(
    JSON.stringify({
      iss: clientEmail,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    })
  )

  const signingInput = `${header}.${claims}`
  const signer = createSign('RSA-SHA256')
  signer.update(signingInput)
  const signature = base64url(signer.sign(privateKey))

  const jwt = `${signingInput}.${signature}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
  })

  const json = (await res.json()) as { access_token: string; expires_in: number }

  _tokenCache = {
    token: json.access_token,
    expiresAt: now + (json.expires_in ?? 3600),
  }

  return _tokenCache.token
}

/**
 * Test helpers — NOT for production use.
 * _resetTokenCache: clears cached token and removes any injected fetcher override.
 * _setTokenFetcher: injects a fake fetcher to bypass RSA signing in unit tests.
 */
export function _resetTokenCache(): void {
  _tokenCache = null
  _tokenFetcherOverride = null
}

export function _setTokenFetcher(fn: (() => Promise<string>) | null): void {
  _tokenFetcherOverride = fn
}

export async function sendFcmMessage(
  token: string,
  msg: { title: string; body: string; data?: Record<string, string> }
): Promise<{ ok: boolean; invalidToken: boolean }> {
  try {
    const accessToken = await getAccessToken()

    const projectId = process.env.FCM_PROJECT_ID!
    const url = `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`

    const body: Record<string, unknown> = {
      message: {
        token,
        notification: { title: msg.title, body: msg.body },
        ...(msg.data ? { data: msg.data } : {}),
      },
    }

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    })

    if (res.ok) {
      return { ok: true, invalidToken: false }
    }

    if (res.status === 404) {
      return { ok: false, invalidToken: true }
    }

    if (res.status === 400) {
      try {
        const errJson = (await res.json()) as {
          error?: { details?: Array<{ errorCode?: string }> }
        }
        const details = errJson?.error?.details ?? []
        const isInvalid = details.some(
          (d) => d.errorCode === 'UNREGISTERED' || d.errorCode === 'INVALID_ARGUMENT'
        )
        if (isInvalid) {
          return { ok: false, invalidToken: true }
        }
      } catch {
        // ignore json parse failure
      }
    }

    return { ok: false, invalidToken: false }
  } catch {
    return { ok: false, invalidToken: false }
  }
}
