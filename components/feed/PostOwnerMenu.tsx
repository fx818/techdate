'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ActionMenu } from '@/components/ui/ActionMenu'

export function PostOwnerMenu({ postId, title, content }: { postId: string; title: string; content: string | null }) {
  const router = useRouter()
  const [editing, setEditing] = useState(false)
  const [t, setT] = useState(title)
  const [c, setC] = useState(content ?? '')

  async function save() {
    await fetch(`/api/posts/${postId}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title: t, content: c }) })
    setEditing(false); router.refresh()
  }
  async function del() {
    if (!confirm('Delete this post?')) return
    await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    router.push('/feed')
  }

  return (
    <>
      <ActionMenu items={[
        { label: 'Edit', onClick: () => setEditing(true) },
        { label: 'Delete', onClick: del, danger: true },
      ]} />
      {editing && (
        <div className="fixed inset-0 z-50 bg-ink/40 backdrop-blur-sm flex items-center justify-center px-4">
          <div className="card w-full max-w-md p-5 space-y-3 animate-pop">
            <h2 className="font-display text-2xl text-ink">Edit post</h2>
            <input value={t} onChange={e => setT(e.target.value)} className="input" />
            <textarea value={c} onChange={e => setC(e.target.value)} className="input h-28 resize-none" />
            <div className="flex gap-2 justify-end">
              <button onClick={() => setEditing(false)} className="btn btn-ghost text-sm">Cancel</button>
              <button onClick={save} disabled={!t.trim()} className="btn btn-primary text-sm">Save</button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
