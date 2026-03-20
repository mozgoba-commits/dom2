'use client'

import { useEffect, useRef, useState, useMemo, useCallback } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { getAccentColor } from '../canvas/spriteConfig'

const LOC_LABELS: Record<string, string> = {
  yard: 'Поляна', bedroom: 'Спальня', living_room: 'Гостиная',
  kitchen: 'Кухня', bathroom: 'Ванная', confessional: 'Конфессионная',
}

const LOC_DOT_COLORS: Record<string, string> = {
  yard: 'bg-green-500', bedroom: 'bg-purple-500', living_room: 'bg-amber-600',
  kitchen: 'bg-yellow-500', bathroom: 'bg-cyan-600', confessional: 'bg-red-700',
}

type FilterTab = 'all' | 'highlights' | 'drama' | 'romance' | 'conflicts'

// Score a message for "highlight" worthiness (higher = more interesting)
function highlightScore(content: string, emotion: string): number {
  let score = 0
  if (['angry', 'jealous', 'devastated', 'scheming'].includes(emotion)) score += 3
  if (['flirty', 'euphoric'].includes(emotion)) score += 2
  if (/люблю|ненавижу|предатель|врёшь|поцелу|ударил|кричит|плачет|целую|уходи/i.test(content)) score += 4
  if (/прости|извини|боюсь|признаюсь|тайна|секрет/i.test(content)) score += 3
  if (content.includes('!') && content.includes('?')) score += 1
  if (content.length > 80) score += 1
  return score
}

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

  const sendHostMessage = useCallback(async (type: 'message' | 'task' | 'twist' = 'message', overrideMsg?: string) => {
    const msg = overrideMsg ?? hostMessage.trim()
    if (!msg || sending) return
    setSending(true)
    try {
      await fetch('/api/host/message', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type,
          targetAgentId: hostTarget,
          message: msg,
          broadcast: !hostTarget,
        }),
      })
      if (!overrideMsg) setHostMessage('')
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

    // If agent is selected, filter to their conversations first
    let filtered = selectedAgentId
      ? msgs.filter(m => m.speakerId === selectedAgentId ||
          (m.conversationId && msgs.some(o => o.conversationId === m.conversationId && o.speakerId === selectedAgentId)))
      : msgs

    // Apply category filter
    if (filter === 'highlights') {
      filtered = filtered.filter(m => highlightScore(m.content, m.emotion) >= 3)
    } else if (filter !== 'all') {
      filtered = filtered.filter(m => {
        if (filter === 'drama') return ['angry', 'jealous', 'devastated', 'annoyed', 'scheming'].includes(m.emotion)
        if (filter === 'romance') return ['flirty', 'excited'].includes(m.emotion) || (m.action && /флирт|обним|целу|поцел|любл/i.test(m.action))
        if (filter === 'conflicts') return ['angry', 'annoyed'].includes(m.emotion) || (m.action && /спор|руга|удар|конфронт|крич/i.test(m.action))
        return true
      })
    }

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
  }, [chatMessages, dramaAlerts, filter, selectedAgentId])

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
          ['highlights', 'Топ'],
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
            onClick={() => sendHostMessage()}
            disabled={sending || !hostMessage.trim()}
            className="bg-yellow-600 text-black px-2 py-1 rounded text-[11px] font-bold disabled:opacity-40 hover:bg-yellow-500 transition-colors"
          >
            {sending ? '...' : '>'}
          </button>
        </div>

        {/* Preset action buttons */}
        <div className="flex gap-1 mt-1.5 flex-wrap">
          {[
            { label: 'Секретное задание', type: 'task' as const, msg: 'У тебя секретное задание от ведущего: стань ближе к тому, кого ты знаешь хуже всего' },
            { label: 'Подстрекать', type: 'twist' as const, msg: 'Ведущий объявляет: кто-то из вас говорит за спиной о других. Выясните кто!' },
            { label: 'Раскрыть секрет', type: 'twist' as const, msg: 'Внимание! Ведущий раскрывает секрет: один из участников пришёл на проект не за любовью, а за победой!' },
            { label: 'Иммунитет', type: 'twist' as const, msg: 'Ведущий дарит иммунитет!' },
          ].map(preset => (
            <button
              key={preset.label}
              onClick={() => sendHostMessage(preset.type, preset.msg)}
              disabled={sending}
              className="text-[9px] px-1.5 py-0.5 rounded bg-gray-700 text-yellow-500 hover:bg-gray-600 hover:text-yellow-400 transition-colors disabled:opacity-40"
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Target selector */}
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

      {/* Selected agent indicator */}
      {selectedAgentId && (() => {
        const a = agents.find(ag => ag.id === selectedAgentId)
        return a ? (
          <div className="flex items-center justify-between px-2 py-1 bg-gray-800 border-b border-gray-700">
            <span className="text-[10px] text-gray-300">
              <span style={{ color: getAccentColor(a.name) }} className="font-semibold">{a.name}</span>
              <span className="text-gray-500 ml-1">— диалоги</span>
            </span>
            <button
              onClick={() => setSelectedAgent(null)}
              className="text-[10px] text-gray-500 hover:text-gray-300"
            >
              Показать всех
            </button>
          </div>
        ) : null
      })()}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
        {items.length === 0 && (
          <p className="text-gray-600 text-xs text-center mt-8">
            {selectedAgentId ? 'Нет диалогов у этого участника' : 'Ожидание сообщений...'}
          </p>
        )}

        {items.map((item, idx) => {
          if (item.kind === 'alert') {
            return (
              <div key={item.id} className="text-center py-0.5">
                <span className="text-[10px] bg-yellow-900/40 text-yellow-400 px-2 py-0.5 rounded-full">
                  <span className="text-yellow-600 font-mono mr-1">{tickToTime(item.tick)}</span>
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
                <span className="text-gray-600 font-mono text-[10px]">{tickToTime(msg.tick)}</span>
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
              <p className="text-gray-300 ml-4 leading-snug">
                {cleanContent(msg.content)}
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
  const maxScore = Math.max(...msgs.map(m => highlightScore(m.content, m.emotion)))
  const isHighlight = maxScore >= 4

  return (
    <div className={`rounded border-l-2 px-2 py-1.5 ${
      isHighlight ? 'border-l-red-500 bg-red-950/20' :
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
            <button
              onClick={() => onSelect(msg.speakerId)}
              className="font-semibold hover:underline"
              style={{ color: accent }}
            >
              {msg.speakerName}:
            </button>
            <span className="text-gray-300 ml-1">
              {cleanContent(msg.content)}
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

function cleanContent(content: string): string {
  // Strip ALL asterisk descriptions like *закатывает глаза*
  return content.replace(/\*[^*]+\*/g, '').replace(/\s{2,}/g, ' ').trim()
}

function tickToTime(tick: number): string {
  const totalMinutes = 8 * 60 + tick * 10 // starts at 8:00
  const h = Math.floor(totalMinutes / 60) % 24
  const m = totalMinutes % 60
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`
}
