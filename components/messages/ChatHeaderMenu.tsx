'use client'
import { useRouter } from 'next/navigation'
import { ActionMenu } from '@/components/ui/ActionMenu'

export function ChatHeaderMenu({ matchId, otherUserId }: { matchId: string; otherUserId: string }) {
  const router = useRouter()
  async function unmatch() {
    if (!confirm('Unmatch and delete this conversation?')) return
    await fetch(`/api/matches/${matchId}`, { method: 'DELETE' })
    router.push('/matches')
  }
  async function block() {
    if (!confirm('Block this person? They will be removed from your matches and feed.')) return
    await fetch('/api/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_id: otherUserId }) })
    router.push('/matches')
  }
  async function report() {
    const reason = prompt('Why are you reporting this person? (harassment, spam, fake, other)')
    if (!reason) return
    await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_type: 'user', target_id: otherUserId, reason }) })
    alert('Reported. Thank you — our team will review.')
  }
  return <ActionMenu items={[
    { label: 'Report', onClick: report },
    { label: 'Block', onClick: block, danger: true },
    { label: 'Unmatch', onClick: unmatch, danger: true },
  ]} />
}
