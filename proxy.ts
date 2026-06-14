import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl

  try {
    let supabaseResponse = NextResponse.next({ request })

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() { return request.cookies.getAll() },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
            supabaseResponse = NextResponse.next({ request })
            cookiesToSet.forEach(({ name, value, options }) =>
              supabaseResponse.cookies.set(name, value, options)
            )
          },
        },
      }
    )

    const { data: { user } } = await supabase.auth.getUser()

    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/onboarding')

    if (!user && !isAuthRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }

    if (user && pathname === '/') {
      return NextResponse.redirect(new URL('/feed', request.url))
    }

    supabaseResponse.headers.set('x-pathname', pathname)
    return supabaseResponse
  } catch {
    // If Supabase init fails, redirect to login rather than 404
    const isAuthRoute = pathname.startsWith('/login') || pathname.startsWith('/onboarding')
    if (!isAuthRoute) {
      return NextResponse.redirect(new URL('/login', request.url))
    }
    return NextResponse.next({ request })
  }
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|api|auth).*)'],
}
