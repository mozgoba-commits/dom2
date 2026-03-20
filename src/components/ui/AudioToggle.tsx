'use client'

import { useViewStore } from '../../store/viewStore'
import { setMuted } from '../../engine/audio'

export default function AudioToggle() {
  const audioMuted = useViewStore(s => s.audioMuted)
  const toggleAudio = useViewStore(s => s.toggleAudio)

  const handleToggle = () => {
    const newMuted = !audioMuted
    setMuted(newMuted)
    toggleAudio()
  }

  return (
    <button
      onClick={handleToggle}
      className="text-xs text-gray-400 hover:text-white px-2 py-1 rounded bg-gray-800 transition-colors"
      title={audioMuted ? 'Включить звук' : 'Выключить звук'}
    >
      {audioMuted ? 'Тихо' : 'Звук'}
    </button>
  )
}
