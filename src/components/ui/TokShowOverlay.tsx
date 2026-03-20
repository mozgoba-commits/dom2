'use client'

import { useState, useEffect, useRef } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { getAccentColor } from '../canvas/spriteConfig'

interface TokShowStatement {
  agentId: string
  name: string
  text: string
}

export default function TokShowOverlay() {
  const tokShow = useSimulationStore(s => s.activeTokShow)
  const setSelectedAgent = useSimulationStore(s => s.setSelectedAgent)
  const [visibleIdx, setVisibleIdx] = useState(0)
  const [dismissed, setDismissed] = useState(false)
  const prevTopicRef = useRef<string | null>(null)

  // Reset when new tok show starts
  useEffect(() => {
    if (tokShow && tokShow.topic !== prevTopicRef.current) {
      prevTopicRef.current = tokShow.topic
      setVisibleIdx(0)
      setDismissed(false)
    }
  }, [tokShow])

  // Auto-advance statements
  useEffect(() => {
    if (!tokShow || dismissed) return
    if (visibleIdx >= tokShow.statements.length) return
    const timer = setTimeout(() => setVisibleIdx(i => i + 1), 4000)
    return () => clearTimeout(timer)
  }, [visibleIdx, tokShow, dismissed])

  if (!tokShow || dismissed) return null

  const { topic, statements } = tokShow
  const shown = statements.slice(0, visibleIdx + 1)

  return (
    <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-30 w-full max-w-lg px-4">
      <div className="bg-gray-900/95 border border-yellow-600/60 rounded-xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-700 to-red-700 px-4 py-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-sm bg-yellow-400" />
            <span className="text-white font-bold text-sm">ТОК-ШОУ</span>
          </div>
          <button onClick={() => setDismissed(true)} className="text-white/60 hover:text-white text-sm font-mono">X</button>
        </div>

        {/* Topic */}
        <div className="px-4 py-2 border-b border-gray-700">
          <p className="text-yellow-300 text-sm font-medium text-center italic">&laquo;{topic}&raquo;</p>
        </div>

        {/* Statements */}
        <div className="px-4 py-2 max-h-60 overflow-y-auto space-y-2">
          {shown.map((s, i) => {
            const accent = getAccentColor(s.name)
            return (
              <div
                key={`${s.agentId}-${i}`}
                className="flex gap-2 items-start animate-fade-in"
              >
                <span
                  className="w-2 h-2 rounded-full mt-1.5 flex-shrink-0"
                  style={{ backgroundColor: accent }}
                />
                <div>
                  <button
                    onClick={() => setSelectedAgent(s.agentId)}
                    className="font-bold text-xs hover:underline"
                    style={{ color: accent }}
                  >
                    {s.name}:
                  </button>
                  <span className="text-gray-300 text-xs ml-1">{s.text}</span>
                </div>
              </div>
            )
          })}
          {visibleIdx < statements.length && (
            <div className="text-center text-gray-500 text-xs animate-pulse">
              Следующий участник...
            </div>
          )}
        </div>

        {/* Progress bar */}
        <div className="h-1 bg-gray-800">
          <div
            className="h-full bg-yellow-600 transition-all duration-500"
            style={{ width: `${((visibleIdx + 1) / statements.length) * 100}%` }}
          />
        </div>
      </div>
    </div>
  )
}
