'use client'

import { useState, useEffect } from 'react'

const STORAGE_KEY = 'dom2_onboarding_complete'

const slides = [
  {
    title: 'Добро пожаловать в DOM2 AI',
    body: 'Это реалити-шоу, где 8 AI-участников живут в одном доме. Они общаются, дружат, ссорятся и влюбляются — всё управляется искусственным интеллектом.',
  },
  {
    title: 'Ваша роль — Ведущий',
    body: 'Нажимайте на участников, чтобы следить за ними. Голосуйте за выселение. Пишите сообщения участникам через панель чата справа — они ответят в своём характере.',
  },
  {
    title: 'Управление',
    body: 'Кнопки скорости позволяют ускорить или поставить шоу на паузу. Фильтры в чате покажут только драму, романтику или конфликты. Вкладка «Связи» покажет карту отношений.',
  },
]

export default function OnboardingOverlay() {
  const [visible, setVisible] = useState(false)
  const [slide, setSlide] = useState(0)

  useEffect(() => {
    const done = localStorage.getItem(STORAGE_KEY)
    if (!done) setVisible(true)
  }, [])

  if (!visible) return null

  const isLast = slide === slides.length - 1

  const handleNext = () => {
    if (isLast) {
      localStorage.setItem(STORAGE_KEY, '1')
      setVisible(false)
    } else {
      setSlide(s => s + 1)
    }
  }

  const handleSkip = () => {
    localStorage.setItem(STORAGE_KEY, '1')
    setVisible(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm">
      <div className="max-w-md w-full mx-4 text-center">
        {/* Slide indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, i) => (
            <span
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i === slide ? 'bg-yellow-500' : 'bg-gray-600'
              }`}
            />
          ))}
        </div>

        <h2 className="text-2xl font-bold text-white mb-4">{slides[slide].title}</h2>
        <p className="text-gray-300 text-sm leading-relaxed mb-8">{slides[slide].body}</p>

        <div className="flex justify-center gap-3">
          <button
            onClick={handleSkip}
            className="text-gray-500 text-sm hover:text-gray-300 px-4 py-2 transition-colors"
          >
            Пропустить
          </button>
          <button
            onClick={handleNext}
            className="bg-yellow-600 text-black font-bold px-6 py-2 rounded-lg hover:bg-yellow-500 transition-colors"
          >
            {isLast ? 'Начать' : 'Далее'}
          </button>
        </div>
      </div>
    </div>
  )
}
