'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'

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

const CARD_COLORS = [
  'border-red-600/50', 'border-blue-600/50', 'border-orange-500/50', 'border-pink-600/50',
  'border-teal-600/50', 'border-yellow-500/50', 'border-green-600/50', 'border-purple-600/50',
]

interface AgentInfo {
  id: string
  name: string
  surname: string
  age: number
  gender: string
  archetype: string
  hometown: string
  occupation: string
  education?: string
  catchphrase: string
  physicalDescription: string
  hobbies?: string[]
  favoriteMusic?: string
  favoriteFood?: string
  fears?: string[]
  lifeGoal?: string
  reasonForComing?: string
  idealPartner?: string
  funFact?: string
  secretGoal?: string
  vulnerabilities?: string[]
  mood: string
  location: string
  status: string
  energy: number
  isEvicted: boolean
  evictedOnDay: number | null
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])
  const [expandedId, setExpandedId] = useState<string | null>(null)

  useEffect(() => {
    fetch('/api/agents')
      .then(r => r.json())
      .then(d => setAgents(d.agents))
      .catch(() => {})

    const interval = setInterval(() => {
      fetch('/api/agents')
        .then(r => r.json())
        .then(d => setAgents(d.agents))
        .catch(() => {})
    }, 10000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="min-h-screen bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-3xl font-bold text-white">Участники проекта</h1>
          <Link href="/show" className="text-red-400 hover:text-red-300 text-sm">
            ← Смотреть шоу
          </Link>
        </div>

        <div className="grid md:grid-cols-2 gap-4">
          {agents.map((agent, i) => {
            const isExpanded = expandedId === agent.id
            return (
              <div
                key={agent.id}
                className={`bg-gray-900 border ${CARD_COLORS[i % CARD_COLORS.length]} rounded-xl p-5 transition-all ${
                  agent.isEvicted ? 'opacity-50 grayscale' : ''
                }`}
              >
                {/* Header */}
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-14 h-14 bg-gray-800 rounded-lg flex items-center justify-center text-2xl font-bold text-gray-300">
                    {agent.name[0]}
                  </div>
                  <div className="flex-1">
                    <h2 className="font-bold text-white text-lg">{agent.name} {agent.surname}</h2>
                    <p className="text-gray-400 text-sm">{agent.archetype}, {agent.age} лет</p>
                    <p className="text-gray-500 text-xs">{agent.hometown} · {agent.occupation}</p>
                    {agent.education && <p className="text-gray-600 text-xs">{agent.education}</p>}
                  </div>
                </div>

                {/* Catchphrase */}
                <p className="text-gray-400 text-sm italic mb-3">&quot;{agent.catchphrase}&quot;</p>

                {/* Physical description */}
                <p className="text-gray-500 text-xs mb-3">{agent.physicalDescription}</p>

                {/* Status */}
                {!agent.isEvicted ? (
                  <div className="flex items-center justify-between text-xs mb-3">
                    <span className="text-gray-400 inline-flex items-center gap-1">
                      <span className={`w-2 h-2 rounded-full ${MOOD_DOT_COLOR[agent.mood] ?? 'bg-gray-400'}`} />
                      {MOOD_RU[agent.mood] ?? 'Неизвестно'}
                    </span>
                    <span className="text-gray-500">
                      Энергия: {agent.energy}%
                    </span>
                  </div>
                ) : (
                  <div className="text-xs text-red-400 mb-3">
                    Покинул(а) проект на день {agent.evictedOnDay}
                  </div>
                )}

                {/* Expand toggle */}
                <button
                  onClick={() => setExpandedId(isExpanded ? null : agent.id)}
                  className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {isExpanded ? 'Свернуть' : 'Подробнее...'}
                </button>

                {/* Expanded bio */}
                {isExpanded && (
                  <div className="mt-3 pt-3 border-t border-gray-800 space-y-2 text-xs">
                    {agent.lifeGoal && (
                      <BioRow label="Цель в жизни" value={agent.lifeGoal} />
                    )}
                    {agent.reasonForComing && (
                      <BioRow label="Зачем пришёл" value={agent.reasonForComing} />
                    )}
                    {agent.secretGoal && (
                      <BioRow label="Тайная цель" value={agent.secretGoal} color="text-red-400" />
                    )}
                    {agent.idealPartner && (
                      <BioRow label="Идеал партнёра" value={agent.idealPartner} />
                    )}
                    {agent.hobbies && agent.hobbies.length > 0 && (
                      <BioRow label="Хобби" value={agent.hobbies.join(', ')} />
                    )}
                    {agent.favoriteMusic && (
                      <BioRow label="Музыка" value={agent.favoriteMusic} />
                    )}
                    {agent.favoriteFood && (
                      <BioRow label="Еда" value={agent.favoriteFood} />
                    )}
                    {agent.fears && agent.fears.length > 0 && (
                      <BioRow label="Страхи" value={agent.fears.join(', ')} color="text-amber-400" />
                    )}
                    {agent.vulnerabilities && agent.vulnerabilities.length > 0 && (
                      <BioRow label="Уязвимости" value={agent.vulnerabilities.join(', ')} color="text-amber-400" />
                    )}
                    {agent.funFact && (
                      <BioRow label="Факт" value={agent.funFact} color="text-emerald-400" />
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {agents.length === 0 && (
          <div className="text-center text-gray-500 py-16">
            Загрузка участников...
          </div>
        )}
      </div>
    </div>
  )
}

function BioRow({ label, value, color = 'text-gray-300' }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span className="text-gray-500">{label}: </span>
      <span className={color}>{value}</span>
    </div>
  )
}
