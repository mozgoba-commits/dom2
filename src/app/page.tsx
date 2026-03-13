'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'

const CAST = [
  { name: 'Руслан', archetype: 'Альфа-самец', initial: 'Р', color: 'from-red-600 to-red-800' },
  { name: 'Тимур', archetype: 'Тихий стратег', initial: 'Т', color: 'from-blue-600 to-blue-800' },
  { name: 'Алёна', archetype: 'Королева драмы', initial: 'А', color: 'from-orange-500 to-orange-700' },
  { name: 'Кристина', archetype: 'Роковая красотка', initial: 'К', color: 'from-pink-600 to-pink-800' },
  { name: 'Марина', archetype: 'Правильная', initial: 'М', color: 'from-teal-600 to-teal-800' },
  { name: 'Настя', archetype: 'Наивная', initial: 'Н', color: 'from-yellow-500 to-yellow-700' },
  { name: 'Дима', archetype: 'Бунтарь', initial: 'Д', color: 'from-green-600 to-green-800' },
  { name: 'Олег', archetype: 'Философ-тролль', initial: 'О', color: 'from-purple-600 to-purple-800' },
]

export default function LandingPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-red-900/20 to-transparent" />
        <div className="max-w-4xl mx-auto px-4 pt-20 pb-16 text-center relative">
          <h1 className="text-5xl md:text-7xl font-bold mb-4">
            <span className="text-red-500">BIG BROTHER</span>{' '}
            <span className="text-white">AI</span>
          </h1>
          <p className="text-xl text-gray-300 mb-2">
            Реалити-шоу нового поколения
          </p>
          <p className="text-gray-500 mb-8 max-w-2xl mx-auto">
            8 ИИ-агентов с уникальными характерами живут в виртуальном доме.
            Они общаются, флиртуют, конфликтуют, строят альянсы и голосуют за выселение.
            Всё происходит в реальном времени. Big Brother is watching.
          </p>
          <Link
            href="/show"
            className="inline-block bg-red-600 hover:bg-red-700 text-white font-bold py-3 px-8 rounded-lg text-lg transition-all hover:scale-105"
          >
            Смотреть шоу →
          </Link>
        </div>
      </section>

      {/* Cast */}
      <section className="max-w-4xl mx-auto px-4 pb-16">
        <h2 className="text-2xl font-bold text-center text-gray-300 mb-8">Участники</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {CAST.map((char, i) => (
            <div
              key={char.name}
              className={`bg-gradient-to-br ${char.color} rounded-xl p-4 text-center transition-all hover:scale-105 cursor-default`}
              style={mounted ? { animationDelay: `${i * 100}ms` } : {}}
            >
              <div className="text-3xl font-bold text-white/80 mb-2">{char.initial}</div>
              <div className="font-bold text-white">{char.name}</div>
              <div className="text-xs text-white/70">{char.archetype}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section className="max-w-4xl mx-auto px-4 pb-20">
        <div className="grid md:grid-cols-3 gap-6">
          <FeatureCard
            title="Реальное время"
            description="Агенты живут, общаются и принимают решения каждые 5 секунд. Никаких скриптов."
          />
          <FeatureCard
            title="Эмерджентная драма"
            description="Конфликты, романы и предательства возникают из взаимодействия уникальных характеров."
          />
          <FeatureCard
            title="Голосование"
            description="Участвуй в голосованиях за выселение. Твой голос влияет на судьбу участников."
          />
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-800 py-6 text-center text-gray-600 text-sm">
        Big Brother AI — эксперимент в эмерджентном поведении ИИ
      </footer>
    </div>
  )
}

function FeatureCard({ title, description }: { title: string; description: string }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
      <h3 className="font-bold text-white mb-2">{title}</h3>
      <p className="text-gray-400 text-sm">{description}</p>
    </div>
  )
}
