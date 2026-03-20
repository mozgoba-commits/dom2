'use client'

import { useMemo } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { useViewStore } from '../../store/viewStore'
import { getAccentColor } from '../canvas/spriteConfig'

interface TimelineEvent {
  id: string
  type: 'drama' | 'romance' | 'eviction' | 'event' | 'conflict'
  message: string
  tick: number
  day: number
  hour: number
}

const ICON_COLORS: Record<TimelineEvent['type'], string> = {
  drama: 'bg-yellow-500',
  romance: 'bg-pink-500',
  eviction: 'bg-red-600',
  event: 'bg-blue-500',
  conflict: 'bg-orange-500',
}

const COLOR_MAP: Record<TimelineEvent['type'], string> = {
  drama: 'border-yellow-600',
  romance: 'border-pink-500',
  eviction: 'border-red-600',
  event: 'border-blue-500',
  conflict: 'border-orange-500',
}

export default function Timeline() {
  const showTimeline = useViewStore(s => s.showTimeline)
  const toggleTimeline = useViewStore(s => s.toggleTimeline)
  const dramaAlerts = useSimulationStore(s => s.dramaAlerts)
  const clock = useSimulationStore(s => s.clock)

  const events = useMemo(() => {
    const items: TimelineEvent[] = []

    for (const alert of dramaAlerts) {
      const msg = alert.message
      let type: TimelineEvent['type'] = 'drama'
      if (msg.includes('чувств') || msg.includes('флирт') || msg.includes('романт')) type = 'romance'
      else if (msg.includes('покидает') || msg.includes('выселен') || msg.includes('ВЫСЕЛЕНИЕ')) type = 'eviction'
      else if (msg.includes('ток-шоу') || msg.includes('голосован') || msg.includes('Завтрак') || msg.includes('Обед') || msg.includes('Ужин') || msg.includes('конфессионн')) type = 'event'
      else if (msg.includes('конфликт') || msg.includes('ярост') || msg.includes('спор') || msg.includes('ссор')) type = 'conflict'

      const ticksPerDay = 144
      const day = Math.floor(alert.tick / ticksPerDay) + 1
      const tickInDay = alert.tick % ticksPerDay
      const hour = Math.floor(tickInDay / 6)

      items.push({
        id: alert.id,
        type,
        message: msg,
        tick: alert.tick,
        day,
        hour,
      })
    }

    return items.sort((a, b) => b.tick - a.tick).slice(0, 50)
  }, [dramaAlerts])

  if (!showTimeline) return null

  // Group by day
  const byDay = new Map<number, TimelineEvent[]>()
  for (const e of events) {
    const arr = byDay.get(e.day) || []
    arr.push(e)
    byDay.set(e.day, arr)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={toggleTimeline}>
      <div
        className="bg-gray-900 rounded-xl border border-gray-700 p-4 max-w-md w-full mx-4 max-h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div>
            <h2 className="text-white text-sm font-bold">Хроника событий</h2>
            <span className="text-gray-500 text-xs">
              {events.length} событий | День {clock?.day ?? 1}
            </span>
          </div>
          <button onClick={toggleTimeline} className="text-gray-500 hover:text-white text-lg px-2">&times;</button>
        </div>

        {/* Events */}
        <div className="flex-1 overflow-y-auto space-y-4">
          {events.length === 0 && (
            <p className="text-gray-600 text-xs text-center mt-8">Пока нет событий</p>
          )}

          {[...byDay.entries()].sort(([a], [b]) => b - a).map(([day, dayEvents]) => (
            <div key={day}>
              <div className="text-gray-500 text-[10px] font-bold mb-1 sticky top-0 bg-gray-900 py-1">
                ДЕНЬ {day}
              </div>
              <div className="space-y-1.5 ml-2 border-l border-gray-800 pl-3">
                {dayEvents.map(ev => (
                  <div
                    key={ev.id}
                    className={`text-xs border-l-2 ${COLOR_MAP[ev.type]} pl-2 py-0.5`}
                  >
                    <span className="text-gray-600 mr-1">
                      {String(ev.hour).padStart(2, '0')}:00
                    </span>
                    <span className={`inline-block w-2 h-2 rounded-sm mr-1 ${ICON_COLORS[ev.type]}`} />
                    <span className="text-gray-300">{ev.message}</span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
