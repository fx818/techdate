'use client'

import { useEffect, useRef, useState } from 'react'
import { Send } from 'lucide-react'

interface Message {
  id: string
  content: string
  sender_id: string
  created_at: string
  users?: { name: string }
}

export default function ChatWindow({ matchId, currentUserId }: { matchId: string; currentUserId: string }) {
  const [messages, setMessages] = useState<Message[]>([])
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const bottomRef = useRef<HTMLDivElement>(null)

  async function fetchMessages() {
    try {
      const res = await fetch(`/api/messages?matchId=${matchId}`)
      const d = await res.json()
      setMessages(d.messages ?? [])
    } catch {
      // silently keep existing messages on poll failure
    }
  }

  useEffect(() => {
    fetchMessages()
    const interval = setInterval(fetchMessages, 5000)
    return () => clearInterval(interval)
  }, [matchId])

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  async function send() {
    if (!text.trim() || loading) return
    const content = text.trim()
    setText('')
    setError(null)
    setLoading(true)
    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ matchId, content }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError('Failed to send message')
        setText(content)
      } else if (data.message) {
        setMessages(prev => [...prev, data.message])
      }
    } catch {
      setError('Failed to send message')
      setText(content)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex flex-col flex-1 min-h-0">
      <div className="flex-1 overflow-y-auto space-y-3 py-2">
        {messages.map(msg => {
          const isMe = msg.sender_id === currentUserId
          return (
            <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[70%] px-3 py-2 rounded-2xl text-sm ${
                isMe ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-100'
              }`}>
                {msg.content}
              </div>
            </div>
          )
        })}
        <div ref={bottomRef} />
      </div>

      {error && <p className="text-red-400 text-xs pb-1">{error}</p>}

      <div className="flex gap-2 pt-3 border-t border-gray-800">
        <input value={text} onChange={e => setText(e.target.value)}
          placeholder="Message..."
          onKeyDown={e => e.key === 'Enter' && send()}
          className="flex-1 bg-gray-800 text-white px-4 py-2 rounded-full border border-gray-700 focus:outline-none focus:border-indigo-500 text-sm" />
        <button onClick={send} disabled={loading || !text.trim()}
          className="w-10 h-10 bg-indigo-600 rounded-full flex items-center justify-center disabled:opacity-50">
          <Send size={16} className="text-white" />
        </button>
      </div>
    </div>
  )
}
