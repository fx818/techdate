import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Header } from '@/components/layout/Header'
import { PublicHeader } from '@/components/layout/PublicHeader'
import { StreakPing } from '@/components/layout/StreakPing'
import { SessionWatcher } from '@/components/layout/SessionWatcher'
import { isPersonalEmail, isTrialExpired } from '@/lib/auth/email'
import { isDisposableEmail } from '@/lib/auth/disposable'
import { effectiveStreak } from '@/lib/streak'
import { headers } from 'next/headers'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''

  // Logged-out visitors are allowed on public routes (e.g. a shared /posts link):
  // render a lightweight public shell instead of redirecting to /login.
  if (!user) {
    if (pathname.startsWith('/posts')) {
      return (
        <div className="min-h-screen bg-paper text-ink pb-12">
          <PublicHeader />
          {children}
        </div>
      )
    }
    redirect('/login')
  }

  // One profile fetch, reused for the trial gate and the header.
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('company_email_verified, created_at, name, photo_url, xp, streak_count, last_login_date')
    .eq('id', user.id)
    .single()

  // Company-email requirement. Restricted users may only reach /profile (to find
  // the verify option) and /verify-company. Middleware enforces this on every
  // request; this is defense-in-depth and also covers disposable emails (the
  // disposable blocklist is too large to run in edge middleware).
  const onAllowedUnverifiedRoute =
    pathname.startsWith('/verify-company') || pathname.startsWith('/profile')
  if (profile && !onAllowedUnverifiedRoute) {
    const email = user.email ?? ''
    // Personal emails get a 7-day trial before company verification is required.
    // Disposable / temp-mail addresses are never legitimate here, so they get NO
    // trial — gate them immediately so they can't use (or abuse) the app for a week.
    const needsCompanyEmail =
      !profile.company_email_verified &&
      (isDisposableEmail(email) ||
        (isPersonalEmail(email) && isTrialExpired(profile.created_at)))

    if (needsCompanyEmail) redirect('/verify-company')
  }

  return (
    <div className="min-h-screen bg-paper text-ink pb-24">
      <SessionWatcher />
      <StreakPing />
      <Header
        name={profile?.name ?? ''}
        photoUrl={profile?.photo_url ?? null}
        xp={profile?.xp ?? 0}
        streak={effectiveStreak(profile?.streak_count, profile?.last_login_date)}
      />
      {children}
      <Navbar />
    </div>
  )
}
