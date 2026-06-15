import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

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
