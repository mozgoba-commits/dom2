'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSimulationStore } from '../../store/simulationStore'

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
  catchphrase: string
  physicalDescription: string
  mood: string
  location: string
  status: string
  energy: number
  isEvicted: boolean
  evictedOnDay: number | null
}

export default function AgentsPage() {
  const [agents, setAgents] = useState<AgentInfo[]>([])

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

        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {agents.map((agent, i) => (
            <div
              key={agent.id}
              className={`bg-gray-900 border ${CARD_COLORS[i % CARD_COLORS.length]} rounded-xl p-5 transition-all hover:scale-[1.02] ${
                agent.isEvicted ? 'opacity-50 grayscale' : ''
              }`}
            >
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center text-xl font-bold text-gray-300">
                  {agent.name[0]}
                </div>
                <div>
                  <h2 className="font-bold text-white">{agent.name} {agent.surname}</h2>
                  <p className="text-gray-400 text-sm">{agent.archetype}, {agent.age} лет</p>
                  <p className="text-gray-500 text-xs">{agent.hometown} · {agent.occupation}</p>
                </div>
              </div>

              <p className="text-gray-500 text-xs italic mb-3">&quot;{agent.catchphrase}&quot;</p>

              {!agent.isEvicted ? (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-gray-400 inline-flex items-center gap-1">
                    <span className={`w-2 h-2 rounded-full ${MOOD_DOT_COLOR[agent.mood] ?? 'bg-gray-400'}`} />
                    {MOOD_RU[agent.mood] ?? 'Неизвестно'}
                  </span>
                  <span className="text-gray-500">
                    Энергия: {agent.energy}%
                  </span>
                </div>
              ) : (
                <div className="text-xs text-red-400">
                  Покинул(а) проект на день {agent.evictedOnDay}
                </div>
              )}
            </div>
          ))}
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
