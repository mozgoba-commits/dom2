'use client'

import { useSimulationStore } from '../../store/simulationStore'
import { getAccentColor } from '../canvas/spriteConfig'

export default function FinaleScreen() {
  const finaleData = useSimulationStore(s => s.finaleData)

  if (!finaleData) return null

  const accent = getAccentColor(finaleData.winnerName)

  return (
    <div className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center backdrop-blur-sm">
      <div className="text-center max-w-md mx-4">
        <div className="text-6xl mb-4">&#x1F3C6;</div>
        <h1 className="text-3xl font-bold text-yellow-400 mb-2">ФИНАЛ!</h1>
        <p className="text-gray-400 text-sm mb-6">Победитель проекта DOM2 AI</p>
        <div
          className="text-4xl font-bold mb-4"
          style={{ color: accent }}
        >
          {finaleData.winnerName}
        </div>
        <p className="text-gray-500 text-sm">
          Эпизод {finaleData.episode?.episodeNumber ?? '?'}
        </p>
      </div>
    </div>
  )
}
