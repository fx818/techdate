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
    <button onClick={del} className="w-full text-center text-ink-faint text-xs hover:text-clay-deep py-2 transition-colors">
      Delete account
    </button>
  )
}
