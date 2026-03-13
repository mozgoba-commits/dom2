'use client'

import { useState, useEffect } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { getAccentColor } from '../canvas/spriteConfig'

export default function EvictionScreen() {
  const eviction = useSimulationStore(s => s.activeEviction)
  const clearEviction = useSimulationStore(s => s.clearEviction)
  const [phase, setPhase] = useState<'reveal' | 'farewell' | 'done'>('reveal')

  useEffect(() => {
    if (!eviction) {
      setPhase('reveal')
      return
    }
    setPhase('reveal')
    const t1 = setTimeout(() => setPhase('farewell'), 3000)
    const t2 = setTimeout(() => { setPhase('done'); clearEviction() }, 8000)
    return () => { clearTimeout(t1); clearTimeout(t2) }
  }, [eviction, clearEviction])

  if (!eviction || phase === 'done') return null

  const accent = getAccentColor(eviction.name)

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90">
      <div className="text-center max-w-md px-4">
        {phase === 'reveal' && (
          <div className="animate-fade-in">
            <div className="text-3xl mb-6 text-red-500 font-mono font-bold tracking-widest">EXIT</div>
            <h2 className="text-3xl font-bold text-red-500 mb-3">ВЫСЕЛЕНИЕ</h2>
            <p className="text-gray-400 text-lg mb-6">День {eviction.day}</p>
            <div
              className="text-4xl font-bold mb-4"
              style={{ color: accent }}
            >
              {eviction.name}
            </div>
            <p className="text-gray-500">покидает проект</p>
          </div>
        )}
        {phase === 'farewell' && (
          <div className="animate-fade-in">
            <div className="text-xl mb-4 text-gray-400 font-bold">ПРОЩАНИЕ</div>
            <p className="text-xl text-gray-300 mb-2">
              <span style={{ color: accent }} className="font-bold">{eviction.name}</span>
            </p>
            <p className="text-gray-500 text-lg italic">
              &laquo;{getFarewellQuote(eviction.name)}&raquo;
            </p>
            <button
              onClick={() => { setPhase('done'); clearEviction() }}
              className="mt-6 text-gray-600 hover:text-gray-400 text-sm"
            >
              Продолжить просмотр
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function getFarewellQuote(name: string): string {
  const quotes: Record<string, string> = {
    'Руслан': 'Я ухожу, но я вернусь сильнее!',
    'Тимур': 'Всё было спланировано. Даже мой уход.',
    'Алёна': 'Вы ещё пожалеете обо мне!',
    'Кристина': 'Это шоу без меня — не шоу.',
    'Марина': 'Я честно прошла свой путь.',
    'Настя': 'Жалко... Но я многому научилась.',
    'Дима': 'Свобода! Наконец-то!',
    'Олег': 'Прощайте, подопытные кролики.',
  }
  return quotes[name] ?? 'Прощайте все.'
}
