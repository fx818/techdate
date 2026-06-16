import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { getNotifications } from '@/lib/notifications'
import { MarkNotificationsSeen } from '@/components/layout/MarkNotificationsSeen'
import NotificationsList from '@/components/notifications/NotificationsList'

export default async function NotificationsPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { items } = await getNotifications(supabase, user.id)

  return (
    <div className="max-w-xl mx-auto px-4 py-7 space-y-4">
      <MarkNotificationsSeen />
      <h1 className="font-display text-3xl text-ink leading-none">Notifications</h1>

      {items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-display text-xl text-ink">All quiet</p>
          <p className="text-ink-faint text-sm mt-1">When someone you&apos;re connected with posts, you&apos;ll see it here.</p>
        </div>
      ) : (
        <>
          <p className="text-ink-faint text-xs">Swipe a notification left, or tap it, to view or delete.</p>
          <NotificationsList items={items} />
        </>
      )}
    </div>
  )
}
