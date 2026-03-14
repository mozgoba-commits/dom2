'use client'

import { useSimulationStore } from '../../store/simulationStore'

export default function CatchUpOverlay() {
  const catchUp = useSimulationStore(s => s.catchUpData)
  const dismissCatchUp = useSimulationStore(s => s.dismissCatchUp)

  if (!catchUp) return null

  return (
    <div className="fixed inset-0 z-40 bg-black/85 flex items-center justify-center backdrop-blur-sm">
      <div className="bg-gray-900 border border-gray-700 rounded-xl max-w-lg w-full mx-4 p-6 max-h-[80vh] overflow-y-auto">
        <h2 className="text-xl font-bold text-white text-center mb-1">ЧТО ПРОИЗОШЛО</h2>
        <p className="text-gray-500 text-sm text-center mb-4">
          {catchUp.clock ? `День ${catchUp.clock.day}` : ''} — {catchUp.activeAgentCount} участников
          {catchUp.episode ? ` — Эпизод ${catchUp.episode.episodeNumber}` : ''}
        </p>

        {/* Evictions */}
        {catchUp.evictions && catchUp.evictions.length > 0 && (
          <div className="mb-4">
            <h3 className="text-xs font-bold text-red-400 mb-1">ВЫСЕЛЕНЫ</h3>
            {catchUp.evictions.map((e: { name: string; day: number | null }, i: number) => (
              <p key={i} className="text-sm text-gray-300">
                {e.name} <span className="text-gray-500">(день {e.day})</span>
              </p>
            ))}
          </div>
        )}

        {/* Relationships */}
        {catchUp.relationshipHighlights && (
          <div className="mb-4 space-y-2">
            {catchUp.relationshipHighlights.friends?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-green-400 mb-1">ДРУЗЬЯ</h3>
                {catchUp.relationshipHighlights.friends.map((r: { a: string; b: string; score: number }, i: number) => (
                  <p key={i} className="text-sm text-gray-300">{r.a} + {r.b} <span className="text-green-500">({r.score})</span></p>
                ))}
              </div>
            )}
            {catchUp.relationshipHighlights.rivals?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-red-400 mb-1">ВРАГИ</h3>
                {catchUp.relationshipHighlights.rivals.map((r: { a: string; b: string; score: number }, i: number) => (
                  <p key={i} className="text-sm text-gray-300">{r.a} vs {r.b} <span className="text-red-500">({r.score})</span></p>
                ))}
              </div>
            )}
            {catchUp.relationshipHighlights.romances?.length > 0 && (
              <div>
                <h3 className="text-xs font-bold text-pink-400 mb-1">РОМАНТИКА</h3>
                {catchUp.relationshipHighlights.romances.map((r: { a: string; b: string; score: number }, i: number) => (
                  <p key={i} className="text-sm text-gray-300">{r.a} + {r.b} <span className="text-pink-500">({r.score})</span></p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Drama */}
        {catchUp.drama && (
          <p className="text-xs text-gray-500 text-center mb-4">
            Драма: {catchUp.drama.overall}% | {catchUp.drama.conflicts} конфликтов | {catchUp.drama.romances} романов
          </p>
        )}

        <button
          onClick={dismissCatchUp}
          className="w-full py-2 bg-yellow-600 text-black font-bold rounded-lg hover:bg-yellow-500 transition-colors"
        >
          Понятно
        </button>
      </div>
    </div>
  )
}
