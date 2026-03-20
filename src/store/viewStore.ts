'use client'

import { create } from 'zustand'
import type { LocationId } from '../engine/types'

interface ViewStore {
  zoom: number
  panX: number
  panY: number
  focusedLocation: LocationId | null
  showChat: boolean
  showProfile: boolean
  showRelationshipMap: boolean
  showTimeline: boolean
  audioMuted: boolean
  isMobile: boolean

  setZoom: (zoom: number) => void
  setPan: (x: number, y: number) => void
  focusLocation: (loc: LocationId | null) => void
  toggleChat: () => void
  toggleProfile: () => void
  toggleRelationshipMap: () => void
  toggleTimeline: () => void
  toggleAudio: () => void
  setMobile: (mobile: boolean) => void
}

export const useViewStore = create<ViewStore>((set) => ({
  zoom: 4,
  panX: 0,
  panY: 0,
  focusedLocation: null,
  showChat: true,
  showProfile: false,
  showRelationshipMap: false,
  showTimeline: false,
  audioMuted: true,
  isMobile: false,

  setZoom: (zoom) => set({ zoom: Math.max(1, Math.min(8, zoom)) }),
  setPan: (panX, panY) => set({ panX, panY }),
  focusLocation: (loc) => set({ focusedLocation: loc }),
  toggleChat: () => set(s => ({ showChat: !s.showChat })),
  toggleProfile: () => set(s => ({ showProfile: !s.showProfile })),
  toggleRelationshipMap: () => set(s => ({ showRelationshipMap: !s.showRelationshipMap })),
  toggleTimeline: () => set(s => ({ showTimeline: !s.showTimeline })),
  toggleAudio: () => set(s => ({ audioMuted: !s.audioMuted })),
  setMobile: (isMobile) => set({ isMobile }),
}))
