'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Send, MessageSquare } from 'lucide-react'

type PingState = 'none' | 'pinged' | 'incoming' | 'connected'

export function PingButton({
  otherUserId,
  initialState,
  matchId,
}: {
  otherUserId: string
  initialState: PingState
  matchId?: string | null
}) {
  const router = useRouter()
  const [state, setState] = useState<PingState>(initialState)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function sendPing() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/swipes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ swiped_id: otherUserId, direction: 'right' }),
      })
      if (res.status === 429) { setError('That’s 10 pings for today — try again tomorrow.'); return }
      if (!res.ok) { setError('Something went wrong. Try again.'); return }
      setState('pinged')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  async function acceptPing() {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requester_id: otherUserId, action: 'accept' }),
      })
      const data = await res.json()
      if (!res.ok) { setError('Something went wrong. Try again.'); return }
      if (data.matchId) router.push(`/messages/${data.matchId}`)
      else setState('connected')
    } catch {
      setError('Network error. Try again.')
    } finally {
      setBusy(false)
    }
  }

  if (state === 'connected') {
    return (
      <button onClick={() => matchId && router.push(`/messages/${matchId}`)}
        className="btn btn-primary w-full flex items-center justify-center gap-2">
        <MessageSquare size={18} /> Message
      </button>
    )
  }

  if (state === 'incoming') {
    return (
      <div className="space-y-1.5">
        <button onClick={acceptPing} disabled={busy}
          className="btn btn-primary w-full flex items-center justify-center gap-2">
          {busy ? '···' : <>Accept ping &amp; chat</>}
        </button>
        {error && <p className="text-clay-deep text-xs text-center">{error}</p>}
      </div>
    )
  }

  if (state === 'pinged') {
    return (
      <button disabled
        className="btn btn-ghost w-full flex items-center justify-center gap-2 opacity-70 cursor-default">
        <Send size={16} /> Ping sent
      </button>
    )
  }

  return (
    <div className="space-y-1.5">
      <button onClick={sendPing} disabled={busy}
        className="btn btn-primary w-full flex items-center justify-center gap-2">
        <Send size={18} /> {busy ? '···' : 'Ping to chat'}
      </button>
      {error && <p className="text-clay-deep text-xs text-center">{error}</p>}
    </div>
  )
}
