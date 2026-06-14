'use client'
import { useRouter } from 'next/navigation'
export function DeleteAccount() {
  const router = useRouter()
  async function del() {
    if (!confirm('Delete your account permanently? This cannot be undone.')) return
    if (!confirm('Really delete everything — profile, posts, matches, messages?')) return
    await fetch('/api/account', { method: 'DELETE' })
    router.push('/login')
  }
  return (
    <button onClick={del} className="btn btn-ghost w-full text-sm text-clay-deep border-clay/30">
      Delete account
    </button>
  )
}
