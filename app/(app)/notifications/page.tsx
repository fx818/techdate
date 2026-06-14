import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import Link from 'next/link'
import { getNotifications } from '@/lib/notifications'
import { timeAgo } from '@/lib/time'
import { MarkNotificationsSeen } from '@/components/layout/MarkNotificationsSeen'

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
          <p className="text-ink-faint text-sm mt-1">When someone you matched with posts, you&apos;ll see it here.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((n: any) => (
            <Link key={n.id} href={`/posts/${n.id}`}
              className={`flex items-center gap-3 card p-3.5 hover:border-clay transition-colors ${n.isNew ? 'border-clay/40 bg-clay-tint/30' : ''}`}>
              <div className="w-10 h-10 rounded-full bg-clay-tint flex items-center justify-center text-clay-deep font-display overflow-hidden shrink-0">
                {n.authorPhoto
                  ? <img src={n.authorPhoto} alt={n.authorName} className="w-10 h-10 object-cover" />
                  : n.authorName[0]?.toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-ink">
                  <span className="font-medium">{n.authorName}</span> posted
                </p>
                <p className="text-ink-soft text-sm truncate">{n.title}</p>
              </div>
              <div className="flex flex-col items-end gap-1 shrink-0">
                <span className="text-ink-faint text-xs">{timeAgo(n.created_at)}</span>
                {n.isNew && <span className="w-2 h-2 rounded-full bg-clay" />}
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
