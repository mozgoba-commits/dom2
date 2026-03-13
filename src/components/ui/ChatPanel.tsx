'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { getAccentColor } from '../canvas/spriteConfig'

const LOC_LABELS: Record<string, string> = {
  yard: 'Поляна', bedroom: 'Спальня', living_room: 'Гостиная',
  kitchen: 'Кухня', confessional: 'Конфессионная',
}

const LOC_DOT_COLORS: Record<string, string> = {
  yard: 'bg-green-500', bedroom: 'bg-purple-500', living_room: 'bg-amber-600',
  kitchen: 'bg-yellow-500', confessional: 'bg-red-700',
}

type FilterTab = 'all' | 'drama' | 'romance' | 'conflicts'

export default function ChatPanel() {
  const chatMessages = useSimulationStore(s => s.chatMessages)
  const dramaAlerts = useSimulationStore(s => s.dramaAlerts)
  const agents = useSimulationStore(s => s.agents)
  const selectedAgentId = useSimulationStore(s => s.selectedAgentId)
  const setSelectedAgent = useSimulationStore(s => s.setSelectedAgent)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [filter, setFilter] = useState<FilterTab>('all')
  const [hostMessage, setHostMessage] = useState('')
  const [hostTarget, setHostTarget] = useState<string | null>(null)
  const [sending, setSending] = useState(false)

  const sendHostMessage = useCallback(async () => {
    if (!hostMessage.trim() || sending) return
    setSending(true)
    try {
      await fetch('/api/host/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetAgentId: hostTarget,
          message: hostMessage.trim(),
          broadcast: !hostTarget,
        }),
      })
      setHostMessage('')
    } catch (e) {
      console.warn('Failed to send host message:', e)
    } finally {
      setSending(false)
    }
  }, [hostMessage, hostTarget, sending])

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight
    }
  }, [chatMessages, dramaAlerts])

  const items = useMemo(() => {
    const msgs = chatMessages.slice(-80)
    const alerts = dramaAlerts.slice(-20)

    // Apply filter
    const filtered = filter === 'all' ? msgs : msgs.filter(m => {
      if (filter === 'drama') return ['angry', 'jealous', 'devastated', 'annoyed', 'scheming'].includes(m.emotion)
      if (filter === 'romance') return ['flirty', 'excited'].includes(m.emotion) || (m.action && /флирт|обним|целу|поцел|любл/i.test(m.action))
      if (filter === 'conflicts') return ['angry', 'annoyed'].includes(m.emotion) || (m.action && /спор|руга|удар|конфронт|крич/i.test(m.action))
      return true
    })

    // Group by conversationId
    type Item =
      | { kind: 'alert'; id: string; message: string; tick: number }
      | { kind: 'convo'; convId: string; msgs: typeof msgs; tick: number }
      | { kind: 'msg'; msg: typeof msgs[0]; tick: number }

    const result: Item[] = []
    const convMap = new Map<string, typeof msgs>()

    for (const m of filtered) {
      if (m.conversationId) {
        const arr = convMap.get(m.conversationId) || []
        arr.push(m)
        convMap.set(m.conversationId, arr)
      } else {
        result.push({ kind: 'msg', msg: m, tick: m.tick })
      }
    }

    for (const [convId, convMsgs] of convMap) {
      result.push({ kind: 'convo', convId, msgs: convMsgs, tick: convMsgs[0].tick })
    }

    for (const a of alerts) {
      result.push({ kind: 'alert', id: a.id, message: a.message, tick: a.tick })
    }

    result.sort((a, b) => a.tick - b.tick)
    return result.slice(-40)
  }, [chatMessages, dramaAlerts, filter])

  return (
    <div className="flex flex-col h-full bg-gray-900 border-l border-gray-700">
      {/* Header */}
      <div className="px-3 py-2 border-b border-gray-700 bg-gray-800 flex items-center justify-between">
        <h2 className="text-xs font-bold text-white tracking-wide">BIG BROTHER AI</h2>
        <span className="text-[10px] text-gray-500">{chatMessages.length} сообщ.</span>
      </div>

      {/* Filters */}
      <div className="flex gap-1 px-2 py-1.5 border-b border-gray-800 bg-gray-900">
        {([
          ['all', 'Все'],
          ['drama', 'Драма'],
          ['romance', 'Романт.'],
          ['conflicts', 'Конфл.'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            onClick={() => setFilter(key)}
            className={`text-[10px] px-2 py-0.5 rounded transition-colors ${
              filter === key
                ? 'bg-gray-600 text-white'
                : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Host input */}
      <div className="border-b border-gray-700 px-2 py-2 bg-gray-800/50">
        <div className="flex gap-1.5">
          <input
            value={hostMessage}
            onChange={e => setHostMessage(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && sendHostMessage()}
            placeholder="Обратиться к участникам..."
            disabled={sending}
            className="flex-1 bg-gray-800 text-white text-[11px] px-2 py-1 rounded border border-gray-600 focus:border-yellow-600 outline-none disabled:opacity-50"
          />
          <button
            onClick={sendHostMessage}
            disabled={sending || !hostMessage.trim()}
            className="bg-yellow-600 text-black px-2 py-1 rounded text-[11px] font-bold disabled:opacity-40 hover:bg-yellow-500 transition-colors"
          >
            {sending ? '...' : '>'}
          </button>
        </div>
        <div className="flex gap-1 mt-1 flex-wrap">
          <button
            onClick={() => setHostTarget(null)}
            className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
              hostTarget === null ? 'bg-yellow-700 text-white' : 'text-gray-500 hover:text-gray-300'
            }`}
          >
            Все
          </button>
          {agents.map(a => (
            <button
              key={a.id}
              onClick={() => setHostTarget(a.id)}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-colors ${
                hostTarget === a.id ? 'bg-yellow-700 text-white' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              {a.name}
            </button>
          ))}
        </div>
      </div>

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {items.length === 0 && (
          <p className="text-gray-600 text-xs text-center mt-8">Ожидание сообщений...</p>
        )}

        {items.map((item, idx) => {
          if (item.kind === 'alert') {
            return (
              <div key={item.id} className="text-center py-0.5">
                <span className="text-[10px] bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
                  {item.message}
                </span>
              </div>
            )
          }

          if (item.kind === 'convo') {
            return (
              <ConvoBlock
                key={item.convId}
                msgs={item.msgs}
                selectedAgentId={selectedAgentId}
                onSelect={setSelectedAgent}
              />
            )
          }

          // Standalone message
          const { msg } = item
          const accent = getAccentColor(msg.speakerName)
          const isMe = selectedAgentId === msg.speakerId
          const isHostResponse = msg.action === 'отвечает ведущему'

          return (
            <div
              key={msg.id}
              className={`px-2 py-1 rounded text-[12px] ${
                isHostResponse ? 'border-l-2 border-l-yellow-500 bg-yellow-900/20' :
                isMe ? 'bg-gray-800/60' : ''
              }`}
            >
              <span className="inline-flex items-center gap-1">
                <Dot color={accent} />
                <button
                  onClick={() => setSelectedAgent(msg.speakerId)}
                  className="font-semibold hover:underline"
                  style={{ color: accent }}
                >
                  {msg.speakerName}
                </button>
                <span className="text-gray-600 text-[10px] inline-flex items-center gap-0.5">
                  <span className={`inline-block w-1.5 h-1.5 rounded-full ${LOC_DOT_COLORS[msg.location] ?? 'bg-gray-500'}`} />
                  {LOC_LABELS[msg.location]}
                </span>
              </span>
              {msg.action && (
                <span className="text-gray-500 italic text-[11px] ml-1">*{msg.action}*</span>
              )}
              <p className="text-gray-300 ml-4 leading-snug">
                {cleanContent(msg.content, msg.action)}
              </p>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Conversation block ──────────────────────────────────────

function ConvoBlock({
  msgs,
  selectedAgentId,
  onSelect,
}: {
  msgs: Array<{
    id: string; speakerName: string; speakerId: string
    content: string; emotion: string; action?: string; location: string; tick: number
  }>
  selectedAgentId: string | null
  onSelect: (id: string) => void
}) {
  const participants = [...new Set(msgs.map(m => m.speakerName))]
  const location = msgs[0]?.location || ''
  const isRelevant = selectedAgentId && msgs.some(m => m.speakerId === selectedAgentId)

  return (
    <div className={`rounded border-l-2 px-2 py-1.5 ${
      isRelevant ? 'border-l-white bg-gray-800/70' : 'border-l-gray-700 bg-gray-800/30'
    }`}>
      {/* Header: time + location + participants */}
      <div className="flex items-center gap-1 mb-1 text-[10px] text-gray-500">
        <span className="text-gray-600 font-mono">{tickToTime(msgs[0].tick)}</span>
        <span className={`inline-block w-1.5 h-1.5 rounded-full ${LOC_DOT_COLORS[location] ?? 'bg-gray-500'}`} />
        <span>{LOC_LABELS[location]}</span>
        <span className="text-gray-700">·</span>
        {participants.map(name => (
          <span key={name} className="flex items-center gap-0.5">
            <Dot color={getAccentColor(name)} />
            <span>{name}</span>
          </span>
        ))}
      </div>

      {/* Messages — compact inline format */}
      {msgs.map(msg => {
        const accent = getAccentColor(msg.speakerName)
        return (
          <div key={msg.id} className="text-[12px] leading-snug py-0.5">
            {msg.action && (
              <span className="text-gray-600 italic text-[10px]">*{msg.action}* </span>
            )}
            <button
              onClick={() => onSelect(msg.speakerId)}
              className="font-semibold hover:underline"
              style={{ color: accent }}
            >
              {msg.speakerName}:
            </button>
            <span className="text-gray-300 ml-1">
              {cleanContent(msg.content, msg.action)}
            </span>
          </div>
        )
      })}
    </div>
  )
}

// ─── Helpers ─────────────────────────────────────────────────

function Dot({ color }: { color: string }) {
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full flex-shrink-0"
      style={{ backgroundColor: color }}
    />
  )
}

function cleanContent(content: string, action?: string): string {
  if (action) {
    const escaped = action.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    content = content.replace(new RegExp(`^\\*${escaped}\\*\\s*`), '')
  }
  return content.replace(/^\*[^*]+\*\s*/, '')
}

function tickToTime(tick: number): string {
  const totalMinutes = 8 * 60 + tick * 10 // starts at 8:00
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
