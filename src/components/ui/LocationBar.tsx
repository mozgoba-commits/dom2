'use client'

import { useViewStore } from '../../store/viewStore'
import { useSimulationStore } from '../../store/simulationStore'
import type { LocationId } from '../../engine/types'

const LOC_DOT_COLORS: Record<LocationId, string> = {
  yard: 'bg-green-500',
  bedroom: 'bg-purple-500',
  living_room: 'bg-amber-600',
  kitchen: 'bg-yellow-500',
  bathroom: 'bg-cyan-600',
  confessional: 'bg-red-700',
}

const LOCATIONS: { id: LocationId; label: string }[] = [
  { id: 'yard', label: 'Поляна' },
  { id: 'bedroom', label: 'Спальня' },
  { id: 'living_room', label: 'Гостиная' },
  { id: 'kitchen', label: 'Кухня' },
  { id: 'bathroom', label: 'Ванная' },
  { id: 'confessional', label: 'Конф.' },
]

export default function LocationBar() {
  const focusedLocation = useViewStore(s => s.focusedLocation)
  const focusLocation = useViewStore(s => s.focusLocation)
  const agents = useSimulationStore(s => s.agents)

  return (
    <div className="flex justify-center gap-1 p-2 bg-gray-900/80 border-t border-gray-800">
      <button
        onClick={() => focusLocation(null)}
        className={`px-3 py-1 rounded text-xs transition-all ${
          !focusedLocation
            ? 'bg-gray-700 text-white'
            : 'bg-gray-800 text-gray-500 hover:text-gray-300'
        }`}
      >
        Все
      </button>
      {LOCATIONS.map(loc => {
        const count = agents.filter(a => a.location === loc.id).length
        const isFocused = focusedLocation === loc.id

        return (
          <button
            key={loc.id}
            onClick={() => focusLocation(isFocused ? null : loc.id)}
            className={`flex items-center gap-1 px-3 py-1 rounded text-xs transition-all ${
              isFocused
                ? 'bg-gray-700 text-white'
                : 'bg-gray-800 text-gray-500 hover:text-gray-300'
            }`}
          >
            <span className={`w-2 h-2 rounded-full ${LOC_DOT_COLORS[loc.id]}`} />
            <span>{loc.label}</span>
            {count > 0 && (
              <span className="bg-gray-600 text-gray-200 rounded-full px-1.5 text-[10px]">
                {count}
              </span>
            )}
          </button>
        )
      })}
    </div>
  )
}
