import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { isPersonalEmail } from '@/lib/auth/email'
import { isDisposableEmail } from '@/lib/auth/disposable'
import { domainHasMx } from '@/lib/auth/mx'

// dns lookups need the Node runtime (not edge).
export const runtime = 'nodejs'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { email } = await request.json()
  const clean = (email ?? '').trim().toLowerCase()
  const domain = clean.split('@')[1]

  if (!clean.includes('@') || !domain) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 })
  }
  if (isPersonalEmail(clean)) {
    return NextResponse.json({ error: 'Please use your company email — Gmail, Yahoo, Outlook and similar personal providers are not accepted.' }, { status: 400 })
  }
  if (isDisposableEmail(clean)) {
    return NextResponse.json({ error: 'Temporary / disposable email addresses are not allowed. Use your real work email.' }, { status: 400 })
  }
  if (!(await domainHasMx(domain))) {
    return NextResponse.json({ error: "That domain can't receive email — double-check your work email address." }, { status: 400 })
  }

  // Valid → trigger the email-change confirmation. Ownership is proven when the
  // user clicks the link sent to that inbox (sets company_email_verified).
  const origin = new URL(request.url).origin
  const { error } = await supabase.auth.updateUser(
    { email: clean },
    { emailRedirectTo: `${origin}/auth/callback?type=email_change` }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  return NextResponse.json({ ok: true })
}
