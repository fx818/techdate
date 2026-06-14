'use client'
import { useRouter } from 'next/navigation'
import { ActionMenu } from '@/components/ui/ActionMenu'

export function PostSafetyMenu({ postId, authorId }: { postId: string; authorId: string }) {
  const router = useRouter()
  async function report() {
    const reason = prompt('Why are you reporting this post? (spam, offensive, other)')
    if (!reason) return
    await fetch('/api/report', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_type: 'post', target_id: postId, reason }) })
    alert('Reported. Thank you.')
  }
  async function block() {
    if (!confirm('Block this author? Their posts and profile will be hidden from you.')) return
    await fetch('/api/block', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ target_id: authorId }) })
    router.push('/feed')
  }
  return <ActionMenu items={[
    { label: 'Report post', onClick: report },
    { label: 'Block author', onClick: block, danger: true },
  ]} />
}
