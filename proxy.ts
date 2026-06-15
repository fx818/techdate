import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { isPersonalEmail, isTrialExpired } from '@/lib/auth/email'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Pass pathname to server components via request header
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-pathname', pathname)

  try {
    let supabaseResponse = NextResponse.next({
      request: { headers: requestHeaders },
    })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request: { headers: requestHeaders } })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    // Public routes: auth pages + post detail pages (shareable, login-free read).
    // `/users` is deliberately NOT public (profile privacy for the matchmaking future).
    const isPublicRoute =
      pathname.startsWith('/login') ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/posts')

    if (!user && !isPublicRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (user && pathname === '/') {
      return NextResponse.redirect(new URL('/feed', request.url))
    }

    // Company-email gate (enforced here so client-side navigations can't bypass it,
    // unlike the layout which doesn't re-run on soft nav): a trial-expired,
    // unverified personal-email user may ONLY reach /profile and /verify-company.
    // Everything else redirects to /verify-company. Skip the DB read for
    // company-email users (never gated) and on the allowed routes.
    if (user && isPersonalEmail(user.email ?? '')) {
      const allowedWhenUnverified =
        pathname.startsWith('/profile') || pathname.startsWith('/verify-company')
      if (!allowedWhenUnverified) {
        const { data: profile } = await (supabase as any)
          .from('users')
          .select('company_email_verified, created_at')
          .eq('id', user.id)
          .maybeSingle()
        if (profile && !profile.company_email_verified && isTrialExpired(profile.created_at)) {
          return NextResponse.redirect(new URL('/verify-company', request.url))
        }
      }
    }

    return supabaseResponse
  } catch {
    const isPublicRoute =
      pathname.startsWith('/login') ||
      pathname.startsWith('/onboarding') ||
      pathname.startsWith('/posts')
    if (!isPublicRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next({ request: { headers: requestHeaders } })
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth).*)'],
}
