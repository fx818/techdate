import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { Header } from '@/components/layout/Header'
import { StreakPing } from '@/components/layout/StreakPing'
import { isPersonalEmail, isTrialExpired } from '@/lib/auth/email'
import { headers } from 'next/headers'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // One profile fetch, reused for the trial gate and the header.
  const { data: profile } = await (supabase as any)
    .from('users')
    .select('company_email_verified, created_at, name, photo_url, xp, streak_count')
    .eq('id', user.id)
    .single()

  // Check company email requirement (skip on the verify-company page itself)
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  if (profile && !pathname.startsWith('/verify-company')) {
    const email = user.email ?? ''
    // Only personal-email users hit the gate; company-email signups are exempt.
    const needsCompanyEmail =
      isPersonalEmail(email) &&
      !profile.company_email_verified &&
      isTrialExpired(profile.created_at)

    if (needsCompanyEmail) redirect('/verify-company')
  }

  return (
    <div className="min-h-screen bg-paper text-ink pb-24">
      <StreakPing />
      <Header
        name={profile?.name ?? ''}
        photoUrl={profile?.photo_url ?? null}
        xp={profile?.xp ?? 0}
        streak={profile?.streak_count ?? 0}
      />
      {children}
      <Navbar />
    </div>
  )
}
