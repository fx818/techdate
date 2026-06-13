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
    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 px-4">
      <div className="bg-gray-900 border border-indigo-700 rounded-2xl p-8 text-center space-y-4 max-w-sm w-full">
        <div className="text-4xl">🎉</div>
        <h2 className="text-2xl font-bold text-white">It&apos;s a Match!</h2>
        <p className="text-gray-400">You and <span className="text-indigo-400">{matchName}</span> liked each other</p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 border border-gray-700 text-gray-300 py-2 rounded-lg">
            Keep Swiping
          </button>
          <button onClick={() => router.push(`/messages/${matchId}`)}
            className="flex-1 bg-indigo-600 text-white py-2 rounded-lg">
            Message
          </button>
        </div>
      </div>
    </div>
  )
}
