'use client'

import { useState, useEffect, useRef } from 'react'

interface VotingBannerProps {
  sessionId: string
  onVoteClick: () => void
}

export default function VotingBanner({ sessionId, onVoteClick }: VotingBannerProps) {
  const [timeLeft, setTimeLeft] = useState(60)
  const startRef = useRef(Date.now())
  const prevSessionRef = useRef(sessionId)

  useEffect(() => {
    if (sessionId !== prevSessionRef.current) {
      startRef.current = Date.now()
      prevSessionRef.current = sessionId
    }

    const timer = setInterval(() => {
      const elapsed = Math.floor((Date.now() - startRef.current) / 1000)
      setTimeLeft(Math.max(0, 60 - elapsed))
    }, 1000)

    return () => clearInterval(timer)
  }, [sessionId])

  if (timeLeft <= 0) return null

  const isPulsing = timeLeft <= 10

  return (
    <div className={`fixed top-10 left-0 right-0 z-30 flex items-center justify-center px-4 py-2 bg-red-900/90 border-b border-red-700 animate-slide-down ${isPulsing ? 'animate-pulse' : ''}`}>
      <span className="text-white font-bold text-sm mr-3">
        ГОЛОСОВАНИЕ ОТКРЫТО
      </span>
      <span className={`font-mono text-sm mr-3 ${timeLeft <= 10 ? 'text-red-300' : 'text-gray-300'}`}>
        0:{String(timeLeft).padStart(2, '0')}
      </span>
      <button
        onClick={onVoteClick}
        className="bg-red-600 hover:bg-red-500 text-white text-xs font-bold px-3 py-1 rounded transition-colors"
      >
        ГОЛОСОВАТЬ
      </button>
    </div>
  )
}
