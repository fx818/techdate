import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const type = searchParams.get('type')

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=missing_code`)
  }

  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll() },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        },
      },
    }
  )

  const { data, error } = await supabase.auth.exchangeCodeForSession(code)
  if (error || !data.user) {
    return NextResponse.redirect(`${origin}/login?error=auth_failed`)
  }

  // Email change = company email confirmation
  if (type === 'email_change') {
    await (supabase as any)
      .from('users')
      .update({ company_email: data.user.email, company_email_verified: true })
      .eq('id', data.user.id)
    return NextResponse.redirect(`${origin}/feed`)
  }

  // New signup — check if onboarding done
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('id')
    .eq('id', data.user.id)
    .single()

  return NextResponse.redirect(`${origin}${profile ? '/feed' : '/onboarding'}`)
}
