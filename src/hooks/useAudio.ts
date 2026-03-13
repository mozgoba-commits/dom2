'use client'

import { useEffect, useRef } from 'react'
import { useSimulationStore } from '../store/simulationStore'
import { useViewStore } from '../store/viewStore'
import { playNotification, startAmbient, stopAmbient } from '../engine/audio'

export function useAudio() {
  const audioMuted = useViewStore(s => s.audioMuted)
  const clock = useSimulationStore(s => s.clock)
  const dramaAlerts = useSimulationStore(s => s.dramaAlerts)
  const activeEviction = useSimulationStore(s => s.activeEviction)
  const prevAlertCountRef = useRef(0)
  const prevTodRef = useRef<string | null>(null)

  // Play drama alert sound
  useEffect(() => {
    if (audioMuted) return
    if (dramaAlerts.length > prevAlertCountRef.current) {
      playNotification('drama')
    }
    prevAlertCountRef.current = dramaAlerts.length
  }, [dramaAlerts.length, audioMuted])

  // Play eviction sound
  useEffect(() => {
    if (audioMuted || !activeEviction) return
    playNotification('eviction')
  }, [activeEviction, audioMuted])

  // Ambient sounds based on time of day
  useEffect(() => {
    if (audioMuted) {
      stopAmbient()
      return
    }
    const tod = clock?.timeOfDay
    if (tod && tod !== prevTodRef.current) {
      prevTodRef.current = tod
      startAmbient(tod)
    }
    return () => stopAmbient()
  }, [clock?.timeOfDay, audioMuted])
}
