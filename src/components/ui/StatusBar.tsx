'use client'

import { useSimulationStore } from '../../store/simulationStore'
import { useViewStore } from '../../store/viewStore'
import AudioToggle from './AudioToggle'

export default function StatusBar() {
  const clock = useSimulationStore(s => s.clock)
  const drama = useSimulationStore(s => s.drama)
  const isConnected = useSimulationStore(s => s.isConnected)
  const agents = useSimulationStore(s => s.agents)
  const toggleRelMap = useViewStore(s => s.toggleRelationshipMap)
  const toggleTimeline = useViewStore(s => s.toggleTimeline)

  const activeCount = agents.filter(a => a.status !== 'sleeping').length

  const timeStr = clock
    ? `День ${clock.day}, ${String(clock.hour).padStart(2, '0')}:${String(clock.minute).padStart(2, '0')}`
    : '—'

  const todLabel = clock?.timeOfDay === 'night' ? 'Ночь' :
    clock?.timeOfDay === 'evening' ? 'Вечер' :
    clock?.timeOfDay === 'morning' ? 'Утро' : 'День'
  const todColor = clock?.timeOfDay === 'night' ? 'bg-indigo-500' :
    clock?.timeOfDay === 'evening' ? 'bg-orange-500' :
    clock?.timeOfDay === 'morning' ? 'bg-yellow-500' : 'bg-sky-500'

  const dramaColor = (drama?.overall ?? 0) > 60
    ? 'text-red-400'
    : (drama?.overall ?? 0) > 30
      ? 'text-yellow-400'
      : 'text-green-400'

  return (
    <div className="flex items-center justify-between px-3 py-1.5 bg-gray-900 border-b border-gray-700 text-sm">
      <div className="flex items-center gap-3">
        <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
        <span className={`w-2 h-2 rounded-full ${todColor}`} />
        <span className="text-white font-mono text-xs">{todLabel} {timeStr}</span>
        <span className="text-gray-500 text-xs">{activeCount} акт.</span>
      </div>
      <div className="flex items-center gap-2">
        <AudioToggle />
        <button
          onClick={toggleTimeline}
          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 transition-colors"
        >
          Хроника
        </button>
        <button
          onClick={toggleRelMap}
          className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 transition-colors"
        >
          Связи
        </button>
        <span className={`${dramaColor} font-bold text-xs`}>
          {drama?.overall ?? 0}%
        </span>
        <span className="text-gray-500 text-[10px] hidden sm:inline">
          {drama?.conflicts ?? 0} конф. | {drama?.romances ?? 0} ром.
        </span>
      </div>
    </div>
  )
}
