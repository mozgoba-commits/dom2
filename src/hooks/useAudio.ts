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
  const activeTokShow = useSimulationStore(s => s.activeTokShow)
  const activeEvents = useSimulationStore(s => s.activeEvents)
  const chatMessages = useSimulationStore(s => s.chatMessages)
  const prevAlertCountRef = useRef(0)
  const prevTodRef = useRef<string | null>(null)
  const prevTokShowRef = useRef<unknown>(null)
  const prevVotingRef = useRef(false)
  const prevMsgCountRef = useRef(0)

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

  // Play tok show start sound
  useEffect(() => {
    if (audioMuted) return
    if (activeTokShow && activeTokShow !== prevTokShowRef.current) {
      playNotification('tok_show_start')
    }
    prevTokShowRef.current = activeTokShow
  }, [activeTokShow, audioMuted])

  // Play voting open sound
  useEffect(() => {
    if (audioMuted) return
    const hasVoting = activeEvents.some(e => e.type === 'voting')
    if (hasVoting && !prevVotingRef.current) {
      playNotification('voting_open')
    }
    prevVotingRef.current = hasVoting
  }, [activeEvents, audioMuted])

  // Play message sound for high-drama chat messages
  useEffect(() => {
    if (audioMuted) return
    if (chatMessages.length > prevMsgCountRef.current) {
      const latest = chatMessages[chatMessages.length - 1]
      if (latest && ['angry', 'jealous', 'devastated', 'scheming'].includes(latest.emotion)) {
        playNotification('message')
      }
    }
    prevMsgCountRef.current = chatMessages.length
  }, [chatMessages.length, audioMuted])

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
