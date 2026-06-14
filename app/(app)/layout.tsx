import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { Navbar } from '@/components/layout/Navbar'
import { isPersonalEmail, trialDaysLeft } from '@/lib/auth/email'
import { headers } from 'next/headers'

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  // Check company email requirement (skip on the verify-company page itself)
  const headersList = await headers()
  const pathname = headersList.get('x-pathname') ?? ''
  if (!pathname.startsWith('/verify-company')) {
    const { data: profile } = await (supabase as any)
      .from('users')
      .select('company_email_verified, created_at')
      .eq('id', user.id)
      .single()

    if (profile) {
      const email = user.email ?? ''
      const needsCompanyEmail =
        isPersonalEmail(email) &&
        !profile.company_email_verified &&
        trialDaysLeft(profile.created_at) === 0

      if (needsCompanyEmail) redirect('/verify-company')
    }
  }

  return (
    <div className="min-h-screen bg-paper text-ink pb-24">
      {children}
      <Navbar />
    </div>
  )
}
