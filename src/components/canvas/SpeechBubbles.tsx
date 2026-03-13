'use client'

import { useEffect, useRef, useState } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { getAccentColor } from './spriteConfig'
import { SCALE, remapPosition } from './HouseScene'

interface VisibleBubble {
  messageId: string
  agentName: string
  content: string
  accentColor: string
  position: { x: number; y: number }
  expiresAt: number
  fading: boolean
}

const MAX_BUBBLES = 2
const BUBBLE_TTL = 4000 // ms

export default function SpeechBubbles() {
  const agents = useSimulationStore(s => s.agents)
  const chatMessages = useSimulationStore(s => s.chatMessages)
  const [bubbles, setBubbles] = useState<VisibleBubble[]>([])
  const lastMsgIdRef = useRef<string>('')

  // Watch for new messages → add bubbles
  useEffect(() => {
    if (chatMessages.length === 0) return
    const latest = chatMessages[chatMessages.length - 1]
    if (latest.id === lastMsgIdRef.current) return
    lastMsgIdRef.current = latest.id

    const agent = agents.find(a => a.id === latest.speakerId)
    if (!agent) return

    const pos = remapPosition(agent.location, agent.position)

    const newBubble: VisibleBubble = {
      messageId: latest.id,
      agentName: latest.speakerName,
      content: latest.content.length > 60 ? latest.content.slice(0, 57) + '...' : latest.content,
      accentColor: getAccentColor(latest.speakerName),
      // Position at head level: cy is feet, head is ~24px above in native coords
      position: { x: pos.x * SCALE, y: (pos.y - 28) * SCALE },
      expiresAt: Date.now() + BUBBLE_TTL,
      fading: false,
    }

    setBubbles(prev => {
      let next = [...prev, newBubble]
      // Remove excess (keep newest MAX_BUBBLES)
      while (next.length > MAX_BUBBLES) {
        next.shift()
      }
      return next
    })
  }, [chatMessages, agents])

  // Expiry timer
  useEffect(() => {
    const interval = setInterval(() => {
      const now = Date.now()
      setBubbles(prev => {
        const updated = prev.map(b => {
          if (!b.fading && now > b.expiresAt - 500) {
            return { ...b, fading: true }
          }
          return b
        })
        return updated.filter(b => now < b.expiresAt)
      })
    }, 250)
    return () => clearInterval(interval)
  }, [])

  // Offset overlapping bubbles
  const adjustedBubbles = bubbles.map((bubble, i) => {
    let yOffset = 0
    for (let j = 0; j < i; j++) {
      const other = bubbles[j]
      if (Math.abs(bubble.position.x - other.position.x) < 150 &&
          Math.abs(bubble.position.y - other.position.y) < 50) {
        yOffset -= 45
      }
    }
    return { ...bubble, yOffset }
  })

  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      {adjustedBubbles.map(bubble => (
        <div
          key={bubble.messageId}
          className={bubble.fading ? 'animate-bubble-out' : 'animate-bubble-in'}
          style={{
            position: 'absolute',
            left: bubble.position.x,
            top: bubble.position.y + (bubble.yOffset || 0),
            transform: 'translate(-50%, -100%)',
            marginTop: '-10px',
          }}
        >
          <div
            className="rounded-lg px-2 py-1.5 shadow-lg relative"
            style={{
              background: 'white',
              borderLeft: `3px solid ${bubble.accentColor}`,
              maxWidth: 180,
            }}
          >
            <div
              className="font-bold text-[10px] leading-tight"
              style={{ color: bubble.accentColor }}
            >
              {bubble.agentName}
            </div>
            <div className="text-[11px] text-gray-700 leading-snug mt-0.5">
              {bubble.content}
            </div>
            {/* Arrow pointing down */}
            <div
              className="absolute top-full left-1/2 -translate-x-1/2"
              style={{
                width: 0,
                height: 0,
                borderLeft: '5px solid transparent',
                borderRight: '5px solid transparent',
                borderTop: `5px solid ${bubble.accentColor}`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  )
}
