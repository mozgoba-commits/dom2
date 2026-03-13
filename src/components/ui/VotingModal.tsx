'use client'

import { useState, useEffect, useRef } from 'react'
import { getAccentColor } from '../canvas/spriteConfig'

interface Nominee {
  id: string
  name: string
}

interface VotingData {
  active: boolean
  sessionId: string
  nominees: Nominee[]
  totalVotes: number
}

const VOTE_TIMER = 60

export default function VotingModal() {
  const [data, setData] = useState<VotingData | null>(null)
  const [voted, setVoted] = useState(false)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [timeLeft, setTimeLeft] = useState(VOTE_TIMER)
  const [sending, setSending] = useState(false)
  const startTimeRef = useRef(Date.now())
  const prevSessionRef = useRef<string | null>(null)

  useEffect(() => {
    const poll = async () => {
      try {
        const res = await fetch('/api/vote')
        const json = await res.json()
        if (json.active) {
          if (prevSessionRef.current !== json.sessionId) {
            prevSessionRef.current = json.sessionId
            startTimeRef.current = Date.now()
            setVoted(false)
            setSelectedId(null)
            setTimeLeft(VOTE_TIMER)
          }
          setData(json)
        } else {
          setData(null)
        }
      } catch { /* ignore */ }
    }
    poll()
    const interval = setInterval(poll, 5000)
    return () => clearInterval(interval)
  }, [])

  // Timer
  useEffect(() => {
    if (!data?.active || voted) return
    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000)
      setTimeLeft(Math.max(0, VOTE_TIMER - elapsed))
    }, 1000)
    return () => clearInterval(timer)
  }, [data?.active, voted])

  if (!data || !data.active || voted) return null

  const handleVote = async () => {
    if (!selectedId || !data.sessionId || sending) return
    setSending(true)
    try {
      const visitorId = getVisitorId()
      await fetch('/api/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: data.sessionId, visitorId, nomineeId: selectedId }),
      })
    } catch { /* ignore */ }
    setSending(false)
    setVoted(true)
  }

  const timerPct = (timeLeft / VOTE_TIMER) * 100
  const timerColor = timeLeft > 30 ? 'bg-green-500' : timeLeft > 10 ? 'bg-yellow-500' : 'bg-red-500'

  return (
    <div className="fixed inset-0 bg-black/85 z-50 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-md w-full mx-4 overflow-hidden">
        {/* Timer bar */}
        <div className="h-1.5 bg-gray-800">
          <div className={`h-full ${timerColor} transition-all duration-1000`} style={{ width: `${timerPct}%` }} />
        </div>

        <div className="p-6">
          <h2 className="text-xl font-bold text-white text-center mb-1">ГОЛОСОВАНИЕ</h2>
          <p className="text-gray-400 text-sm text-center mb-1">Кого выселить с проекта?</p>
          <p className="text-center mb-5">
            <span className={`font-mono text-lg ${timeLeft <= 10 ? 'text-red-400 animate-pulse' : 'text-gray-500'}`}>
              {Math.floor(timeLeft / 60)}:{String(timeLeft % 60).padStart(2, '0')}
            </span>
          </p>

          <div className="space-y-3 mb-6">
            {data.nominees.map(nominee => {
              const accent = getAccentColor(nominee.name)
              const isSelected = selectedId === nominee.id
              return (
                <button
                  key={nominee.id}
                  onClick={() => setSelectedId(nominee.id)}
                  className={`w-full p-4 rounded-lg border text-left transition-all relative overflow-hidden ${
                    isSelected ? 'border-red-500 bg-red-500/10' : 'border-gray-700 bg-gray-800 hover:border-gray-500'
                  }`}
                >
                  <div className="relative flex items-center gap-3">
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ backgroundColor: accent }} />
                    <span className="text-lg font-bold text-white">{nominee.name}</span>
                    {isSelected && <span className="ml-auto w-3 h-3 rounded-full bg-red-500" />}
                  </div>
                </button>
              )
            })}
          </div>

          <div className="text-center text-gray-600 text-xs mb-4">
            Всего голосов: {data.totalVotes}
          </div>

          <button
            onClick={handleVote}
            disabled={!selectedId || sending}
            className={`w-full py-3 rounded-lg font-bold text-white transition-all ${
              selectedId && !sending ? 'bg-red-600 hover:bg-red-700 active:scale-[0.98]' : 'bg-gray-700 cursor-not-allowed'
            }`}
          >
            {sending ? 'Отправка...' : 'Проголосовать'}
          </button>
        </div>
      </div>
    </div>
  )
}

function getVisitorId(): string {
  let id = localStorage.getItem('dom2_visitor_id')
  if (!id) {
    id = Math.random().toString(36).substring(2, 15)
    localStorage.setItem('dom2_visitor_id', id)
  }
  return id
}
