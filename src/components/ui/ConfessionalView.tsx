'use client'

import { useSimulationStore } from '../../store/simulationStore'
import { getAccentColor } from '../canvas/spriteConfig'

export default function ConfessionalView() {
  const confessional = useSimulationStore(s => s.activeConfessional)
  const clearConfessional = useSimulationStore(s => s.clearConfessional)

  if (!confessional) return null

  const accent = getAccentColor(confessional.name)

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-black/85 backdrop-blur-sm" onClick={clearConfessional}>
      <div
        className="max-w-md w-full mx-4 rounded-xl overflow-hidden border border-red-900/50"
        onClick={e => e.stopPropagation()}
      >
        {/* Camera overlay frame */}
        <div className="bg-gray-950 relative">
          {/* REC indicator */}
          <div className="absolute top-3 right-3 flex items-center gap-1.5 z-10">
            <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
            <span className="text-red-500 text-[10px] font-mono font-bold">REC</span>
          </div>

          {/* Timecode */}
          <div className="absolute top-3 left-3 z-10">
            <span className="text-gray-600 text-[10px] font-mono">CAM 06</span>
          </div>

          {/* Vignette + content */}
          <div className="p-6 pt-8 pb-4"
            style={{
              background: 'radial-gradient(ellipse at center, rgba(60,20,20,0.3) 0%, rgba(0,0,0,0.8) 100%)'
            }}
          >
            {/* Spotlight circle */}
            <div className="text-center mb-4">
              <div
                className="inline-flex items-center justify-center w-16 h-16 rounded-full text-2xl"
                style={{
                  backgroundColor: accent + '22',
                  border: `2px solid ${accent}`,
                }}
              >
                <span className="text-sm font-mono font-bold">CAM</span>
              </div>
              <div className="font-bold text-lg mt-2" style={{ color: accent }}>
                {confessional.name}
              </div>
              <div className="text-gray-500 text-xs">в конфессионной</div>
            </div>

            {/* Monologue */}
            <div className="bg-black/40 rounded-lg p-4 border border-gray-800">
              <p className="text-gray-200 text-sm leading-relaxed italic">
                &laquo;{confessional.text}&raquo;
              </p>
            </div>

            {/* Emotion indicator */}
            {confessional.emotion && (
              <div className="text-center mt-3">
                <span className="text-gray-500 text-[10px] bg-gray-800 px-2 py-0.5 rounded">
                  настроение: {getMoodLabel(confessional.emotion)}
                </span>
              </div>
            )}
          </div>

          {/* Scanlines overlay */}
          <div
            className="absolute inset-0 pointer-events-none opacity-10"
            style={{
              backgroundImage: 'repeating-linear-gradient(0deg, transparent, transparent 2px, rgba(0,0,0,0.3) 2px, rgba(0,0,0,0.3) 4px)',
            }}
          />
        </div>

        {/* Bottom bar */}
        <div className="bg-gray-900 px-4 py-2 flex justify-between items-center border-t border-gray-800">
          <span className="text-gray-600 text-[10px]">КОНФЕССИОННАЯ</span>
          <button
            onClick={clearConfessional}
            className="text-gray-500 hover:text-white text-xs px-2 py-1"
          >
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}

function getMoodLabel(mood: string): string {
  const labels: Record<string, string> = {
    happy: 'счастлив', angry: 'злится', sad: 'грустит',
    excited: 'возбуждён', jealous: 'ревнует', flirty: 'флиртует',
    bored: 'скучает', anxious: 'тревога', neutral: 'спокоен',
    annoyed: 'раздражён', devastated: 'опустошён',
    euphoric: 'эйфория', scheming: 'интригует',
  }
  return labels[mood] ?? mood
}
