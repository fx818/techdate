'use client'

import { useRouter } from 'next/navigation'

interface Props {
  matchId: string
  matchName: string
  onClose: () => void
}

export function MatchModal({ matchId, matchName, onClose }: Props) {
  const router = useRouter()

  return (
    <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm flex items-center justify-center z-50 px-5">
      <div className="card p-8 text-center space-y-4 max-w-sm w-full animate-pop">
        <div className="font-display text-5xl text-clay">✷</div>
        <h2 className="font-display text-3xl text-ink">It&apos;s a match</h2>
        <p className="text-ink-soft">You and <span className="text-clay-deep font-medium">{matchName}</span> liked each other.</p>
        <div className="flex gap-3 pt-1">
          <button onClick={onClose} className="btn btn-ghost flex-1">
            Keep swiping
          </button>
          <button onClick={() => router.push(`/messages/${matchId}`)} className="btn btn-primary flex-1">
            Say hello
          </button>
        </div>
      </div>
    </div>
  )
}
