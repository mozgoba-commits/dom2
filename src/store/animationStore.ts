'use client'

import { create } from 'zustand'

export type AnimationState =
  | 'idle' | 'talking' | 'arguing' | 'flirting' | 'eating' | 'sleeping'
  | 'crying' | 'celebrating' | 'thinking' | 'shocked' | 'laughing' | 'walking'

export interface AgentAnimation {
  state: AnimationState
  idlePhase: number            // 0-2pi, breathing cycle
  idleLookTimer: number        // countdown to next look direction change
  idleLookDirection: 'center' | 'left' | 'right'
  actionFrame: number          // current frame within action animation
  actionFrameTimer: number     // accumulator for frame cycling
  actionTarget: string | null  // id of interaction partner
  facingOverride: 'left' | 'right' | null
  reactionQueue: Array<{ type: AnimationState; duration: number }>
}

interface AnimationStore {
  animations: Map<string, AgentAnimation>

  setAnimationState: (agentId: string, state: AnimationState, targetId?: string) => void
  queueReaction: (agentId: string, reaction: { type: AnimationState; duration: number }) => void
  tick: (dt: number) => void
  getAnimation: (agentId: string) => AgentAnimation
  setFacingOverride: (agentId: string, direction: 'left' | 'right' | null) => void
}

const DEFAULT_ANIM: AgentAnimation = {
  state: 'idle',
  idlePhase: 0,
  idleLookTimer: 3,
  idleLookDirection: 'center',
  actionFrame: 0,
  actionFrameTimer: 0,
  actionTarget: null,
  facingOverride: null,
  reactionQueue: [],
}

const IDLE_LOOK_DIRS: Array<'center' | 'left' | 'right'> = ['center', 'left', 'right']
const ACTION_FRAME_RATE = 0.25 // seconds per action frame

export const useAnimationStore = create<AnimationStore>((set, get) => ({
  animations: new Map(),

  setAnimationState: (agentId, state, targetId) => {
    set(prev => {
      const anims = new Map(prev.animations)
      const existing = anims.get(agentId) ?? { ...DEFAULT_ANIM }
      anims.set(agentId, {
        ...existing,
        state,
        actionFrame: 0,
        actionFrameTimer: 0,
        actionTarget: targetId ?? null,
      })
      return { animations: anims }
    })
  },

  queueReaction: (agentId, reaction) => {
    set(prev => {
      const anims = new Map(prev.animations)
      const existing = anims.get(agentId) ?? { ...DEFAULT_ANIM }
      anims.set(agentId, {
        ...existing,
        reactionQueue: [...existing.reactionQueue, reaction],
      })
      return { animations: anims }
    })
  },

  tick: (dt) => {
    const { animations } = get()
    if (animations.size === 0) return

    const updated = new Map(animations)
    let changed = false

    for (const [id, anim] of updated) {
      const a = { ...anim }
      let didChange = false

      // Advance idle phase (breathing)
      a.idlePhase = (a.idlePhase + 2.5 * dt) % (Math.PI * 2)

      // Idle look timer
      a.idleLookTimer -= dt
      if (a.idleLookTimer <= 0) {
        a.idleLookTimer = 2 + Math.random() * 3
        a.idleLookDirection = IDLE_LOOK_DIRS[Math.floor(Math.random() * 3)]
        didChange = true
      }

      // Process reaction queue
      if (a.reactionQueue.length > 0) {
        const reaction = a.reactionQueue[0]
        if (a.state !== reaction.type) {
          a.state = reaction.type
          a.actionFrame = 0
          a.actionFrameTimer = 0
          didChange = true
        }
        reaction.duration -= dt
        if (reaction.duration <= 0) {
          a.reactionQueue = a.reactionQueue.slice(1)
          if (a.reactionQueue.length === 0) {
            a.state = 'idle'
            a.actionFrame = 0
          }
          didChange = true
        }
      }

      // Advance action frame timer
      if (a.state !== 'idle' && a.state !== 'walking') {
        a.actionFrameTimer += dt
        if (a.actionFrameTimer >= ACTION_FRAME_RATE) {
          a.actionFrameTimer -= ACTION_FRAME_RATE
          a.actionFrame = (a.actionFrame + 1) % 4
          didChange = true
        }
      }

      if (didChange) {
        updated.set(id, a)
        changed = true
      } else {
        // Still update phase
        updated.set(id, a)
        changed = true
      }
    }

    if (changed) {
      set({ animations: updated })
    }
  },

  getAnimation: (agentId) => {
    return get().animations.get(agentId) ?? { ...DEFAULT_ANIM }
  },

  setFacingOverride: (agentId, direction) => {
    set(prev => {
      const anims = new Map(prev.animations)
      const existing = anims.get(agentId) ?? { ...DEFAULT_ANIM }
      anims.set(agentId, { ...existing, facingOverride: direction })
      return { animations: anims }
    })
  },
}))
