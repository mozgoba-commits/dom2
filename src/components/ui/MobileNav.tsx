'use client'

import { useViewStore } from '../../store/viewStore'

export default function MobileNav() {
  const toggleChat = useViewStore(s => s.toggleChat)
  const showChat = useViewStore(s => s.showChat)
  const toggleRelMap = useViewStore(s => s.toggleRelationshipMap)
  const toggleTimeline = useViewStore(s => s.toggleTimeline)
  const focusLocation = useViewStore(s => s.focusLocation)
  const focusedLocation = useViewStore(s => s.focusedLocation)

  return (
    <div className="fixed bottom-0 inset-x-0 z-20 bg-gray-900/95 border-t border-gray-700 backdrop-blur-sm safe-area-bottom">
      <div className="flex items-center justify-around py-2 px-1">
        <NavBtn
          label="Поляна"
          active={focusedLocation === 'yard'}
          onClick={() => focusLocation(focusedLocation === 'yard' ? null : 'yard')}
        />
        <NavBtn
          label="Дом"
          active={focusedLocation === 'living_room'}
          onClick={() => focusLocation(focusedLocation === 'living_room' ? null : 'living_room')}
        />
        <NavBtn
          label="Чат"
          active={showChat}
          onClick={toggleChat}
        />
        <NavBtn
          label="Связи"
          active={false}
          onClick={toggleRelMap}
        />
        <NavBtn
          label="Хроника"
          active={false}
          onClick={toggleTimeline}
        />
      </div>
    </div>
  )
}

function NavBtn({ label, active, onClick }: {
  label: string; active: boolean; onClick: () => void
}) {
  return (
    <button
      onClick={onClick}
      className={`flex flex-col items-center gap-0.5 px-3 py-1.5 rounded transition-colors ${
        active ? 'text-white bg-gray-800' : 'text-gray-500'
      }`}
    >
      <span className="text-[11px] font-medium">{label}</span>
    </button>
  )
}
