'use client'

import { useEffect, useState } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { getAppearance, getAccentColor } from '../canvas/spriteConfig'
import type { Agent } from '../../engine/types'

const MOOD_DOT_COLOR: Record<string, string> = {
  happy: 'bg-green-500', angry: 'bg-red-500', sad: 'bg-blue-500', excited: 'bg-yellow-400',
  jealous: 'bg-amber-600', flirty: 'bg-pink-500', bored: 'bg-gray-500', anxious: 'bg-purple-400',
  neutral: 'bg-gray-400', annoyed: 'bg-orange-500', devastated: 'bg-blue-700', euphoric: 'bg-emerald-400', scheming: 'bg-violet-500',
}

const MOOD_RU: Record<string, string> = {
  happy: 'Весёлый', angry: 'Злой', sad: 'Грустный', excited: 'Взволнованный',
  jealous: 'Ревнивый', flirty: 'Флиртует', bored: 'Скучает', anxious: 'Тревожный',
  neutral: 'Спокойный', annoyed: 'Раздражённый', devastated: 'Убитый горем',
  euphoric: 'В эйфории', scheming: 'Что-то замышляет',
}

const LOCATION_RU: Record<string, string> = {
  yard: 'Поляна', bedroom: 'Спальня', living_room: 'Гостиная',
  kitchen: 'Кухня', bathroom: 'Ванная', confessional: 'Конфессионная',
}

interface AgentData {
  agent: Agent
  relationships: {
    agentId: string; name: string; friendship: number
    romance: number; trust: number; rivalry: number
  }[]
  memories: { content: string; type: string; tick: number }[]
}

export default function AgentProfileCard() {
  const selectedAgentId = useSimulationStore(s => s.selectedAgentId)
  const setSelectedAgent = useSimulationStore(s => s.setSelectedAgent)
  const agentSummaries = useSimulationStore(s => s.agents)
  const [data, setData] = useState<AgentData | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!selectedAgentId) {
      setData(null)
      return
    }
    setLoading(true)
    fetch(`/api/agents/${selectedAgentId}`)
      .then(r => r.json())
      .then(d => {
        setData(d)
        setLoading(false)
      })
      .catch(() => setLoading(false))
  }, [selectedAgentId])

  if (!selectedAgentId) return null

  const summary = agentSummaries.find(a => a.id === selectedAgentId)
  if (!summary) return null

  const appearance = getAppearance(summary.name)
  const accent = getAccentColor(summary.name)

  // Recent messages from this agent
  const chatMessages = useSimulationStore.getState().chatMessages
  const recentMessages = chatMessages.filter(m => m.speakerId === selectedAgentId).slice(-5)

  return (
    <div className="fixed right-0 top-0 h-full w-80 bg-gray-900 border-l border-gray-700 z-50 overflow-y-auto shadow-2xl">
      {/* Close button */}
      <button
        onClick={() => setSelectedAgent(null)}
        className="absolute top-3 right-3 text-gray-400 hover:text-white text-xl z-10"
      >
        ×
      </button>

      {data?.agent ? (
        /* ── Full profile (from API) ── */
        <div className="p-4 space-y-4">
          <div className="text-center pt-2">
            <div
              className="w-16 h-16 mx-auto rounded-lg flex items-center justify-center text-3xl mb-2"
              style={{ backgroundColor: accent + '33', borderLeft: `3px solid ${accent}` }}
            >
              <span className="text-sm font-bold" style={{ color: accent }}>{summary?.name?.[0] ?? data?.agent?.bio?.name?.[0] ?? '?'}</span>
            </div>
            <h2 className="text-lg font-bold" style={{ color: accent }}>
              {data.agent.bio.name} {data.agent.bio.surname}
            </h2>
            <p className="text-gray-400 text-sm">{data.agent.archetype}, {data.agent.bio.age} лет</p>
            <p className="text-gray-500 text-xs italic mt-1">&quot;{data.agent.bio.catchphrase}&quot;</p>
          </div>

          <div className="bg-gray-800 rounded-lg p-3 space-y-1 text-sm">
            <InfoRow label="Город" value={data.agent.bio.hometown} />
            <InfoRow label="Профессия" value={data.agent.bio.occupation} />
            <InfoRow label="Хобби" value={data.agent.bio.hobbies.join(', ')} />
            <InfoRow label="Образование" value={data.agent.bio.education} />
          </div>

          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Настроение</span>
              <span className="text-white">
                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${MOOD_DOT_COLOR[summary.mood] ?? 'bg-gray-400'}`} />
                {MOOD_RU[summary.mood]}
              </span>
            </div>
            <BarStat label="Энергия" value={summary.energy} color="bg-green-500" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Локация</span>
              <span className="text-white">{LOCATION_RU[summary.location] ?? summary.location}</span>
            </div>
          </div>

          {data.relationships.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-sm font-bold text-gray-300 mb-2">Отношения</h3>
              <div className="space-y-2">
                {data.relationships.map(rel => (
                  <div key={rel.agentId} className="text-sm">
                    <div className="flex justify-between items-center">
                      <span className="text-white">{getRelIcon(rel)} {rel.name}</span>
                    </div>
                    <div className="flex gap-2 mt-1">
                      <MiniBar label="Др" value={rel.friendship} max={100} min={-100} />
                      <MiniBar label="Ром" value={rel.romance} max={100} min={0} />
                      <MiniBar label="Дов" value={rel.trust} max={100} min={-100} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {data.memories.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-sm font-bold text-gray-300 mb-2">Последнее</h3>
              <div className="space-y-1">
                {data.memories.slice(-5).map((m, i) => (
                  <p key={i} className="text-xs text-gray-400 border-l-2 border-gray-600 pl-2">{m.content}</p>
                ))}
              </div>
            </div>
          )}

          <div className="bg-gray-800 rounded-lg p-3">
            <h3 className="text-sm font-bold text-gray-300 mb-1">Зачем пришёл(а)</h3>
            <p className="text-xs text-gray-400">{data.agent.bio.reasonForComing}</p>
            <h3 className="text-sm font-bold text-gray-300 mt-2 mb-1">Идеальный партнёр</h3>
            <p className="text-xs text-gray-400">{data.agent.bio.idealPartner}</p>
            <h3 className="text-sm font-bold text-gray-300 mt-2 mb-1">Интересный факт</h3>
            <p className="text-xs text-gray-400">{data.agent.bio.funFact}</p>
          </div>
        </div>
      ) : (
        /* ── Summary-only profile (mock mode / API unavailable) ── */
        <div className="p-4 space-y-4">
          <div className="text-center pt-2">
            <div
              className="w-16 h-16 mx-auto rounded-lg flex items-center justify-center text-3xl mb-2"
              style={{ backgroundColor: accent + '33', borderLeft: `3px solid ${accent}` }}
            >
              <span className="text-sm font-bold" style={{ color: accent }}>{summary?.name?.[0] ?? data?.agent?.bio?.name?.[0] ?? '?'}</span>
            </div>
            <h2 className="text-lg font-bold" style={{ color: accent }}>
              {summary.name}
            </h2>
            <p className="text-gray-400 text-sm capitalize">
              {appearance.bodyBuild} {appearance.gender === 'male' ? 'М' : 'Ж'}
              {appearance.accessory ? ` · ${appearance.accessory}` : ''}
            </p>
          </div>

          <div className="bg-gray-800 rounded-lg p-3 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Настроение</span>
              <span className="text-white">
                <span className={`inline-block w-2 h-2 rounded-full mr-1 ${MOOD_DOT_COLOR[summary.mood] ?? 'bg-gray-400'}`} />
                {MOOD_RU[summary.mood]}
              </span>
            </div>
            <BarStat label="Энергия" value={summary.energy} color="bg-green-500" />
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Локация</span>
              <span className="text-white">{LOCATION_RU[summary.location] ?? summary.location}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Статус</span>
              <span className="text-white">{summary.status}</span>
            </div>
          </div>

          {recentMessages.length > 0 && (
            <div className="bg-gray-800 rounded-lg p-3">
              <h3 className="text-sm font-bold text-gray-300 mb-2">Последние реплики</h3>
              <div className="space-y-1.5">
                {recentMessages.map(m => (
                  <div key={m.id} className="text-xs border-l-2 pl-2" style={{ borderColor: accent }}>
                    {m.action && <p className="text-gray-500 italic">*{m.action}*</p>}
                    <p className="text-gray-300">{m.content}</p>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <span className="text-gray-500">{label}</span>
      <span className="text-gray-200 text-right max-w-[60%]">{value}</span>
    </div>
  )
}

function BarStat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div>
      <div className="flex justify-between text-sm mb-1">
        <span className="text-gray-400">{label}</span>
        <span className="text-white">{value}%</span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${value}%` }} />
      </div>
    </div>
  )
}

function MiniBar({ label, value, max, min }: { label: string; value: number; max: number; min: number }) {
  const range = max - min
  const pct = ((value - min) / range) * 100
  const color = value > 0 ? 'bg-green-500' : value < 0 ? 'bg-red-500' : 'bg-gray-500'

  return (
    <div className="flex-1">
      <div className="text-[10px] text-gray-500">{label} {Math.round(value)}</div>
      <div className="h-1 bg-gray-700 rounded-full">
        <div className={`h-full rounded-full ${color}`} style={{ width: `${Math.max(5, pct)}%` }} />
      </div>
    </div>
  )
}

function getRelIcon(rel: { friendship: number; romance: number; rivalry: number }): string {
  if (rel.romance > 50) return '+'
  if (rel.rivalry > 50) return 'x'
  if (rel.friendship > 30) return '+'
  if (rel.friendship < -30) return '-'
  return '~'
}
