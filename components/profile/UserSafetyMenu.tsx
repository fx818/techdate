'use client'
import { useRouter } from 'next/navigation'
import { ActionMenu } from '@/components/ui/ActionMenu'
export function UserSafetyMenu({ userId }: { userId: string }) {
  const router = useRouter()
  async function report() {
    const reason = prompt('Why are you reporting this user? (harassment, spam, fake, other)')
    if (!reason) return
    await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_type: 'user', target_id: userId, reason }) })
    alert('Reported. Thank you.')
  }
  async function block() {
    if (!confirm('Block this user? Their posts and profile will be hidden from you.')) return
    await fetch('/api/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_id: userId }) })
    router.push('/feed')
  }
  return <ActionMenu items={[{ label: 'Report', onClick: report }, { label: 'Block', onClick: block, danger: true }]} />
}
