'use client'

import { create } from 'zustand'
import type { Waypoint } from '../engine/pathfinding'

interface WalkingAgent {
  agentId: string
  path: Waypoint[]            // remaining waypoints
  currentPos: Waypoint        // interpolated position
  speed: number               // pixels per second in native coords
  walkFrame: number           // 0-3 for leg animation
  facing: 'left' | 'right'
  frameTimer: number          // accumulator for walk frame cycling
  onArrive?: () => void       // callback when walking completes
}

interface WalkingStore {
  walkers: Map<string, WalkingAgent>
  startWalk: (agentId: string, from: Waypoint, path: Waypoint[], onArrive?: () => void) => void
  tick: (dt: number) => void
  getPosition: (agentId: string) => Waypoint | null
  isWalking: (agentId: string) => boolean
  getWalkFrame: (agentId: string) => number
  getFacing: (agentId: string) => 'left' | 'right'
}

const WALK_SPEED = 40 // native pixels per second (~1.5px per frame at 30fps)
const FRAME_INTERVAL = 0.15 // seconds between walk frame changes
const ARRIVE_THRESHOLD = 2 // px

export const useWalkingStore = create<WalkingStore>((set, get) => ({
  walkers: new Map(),

  startWalk: (agentId, from, path, onArrive) => {
    set(state => {
      const walkers = new Map(state.walkers)
      walkers.set(agentId, {
        agentId,
        path: [...path],
        currentPos: { ...from },
        speed: WALK_SPEED,
        walkFrame: 0,
        facing: path.length > 0 && path[0].x < from.x ? 'left' : 'right',
        frameTimer: 0,
        onArrive,
      })
      return { walkers }
    })
  },

  tick: (dt) => {
    const { walkers } = get()
    if (walkers.size === 0) return

    const arrived: string[] = []
    const callbacks: Array<() => void> = []
    const newWalkers = new Map(walkers)

    for (const [id, walker] of newWalkers) {
      if (walker.path.length === 0) {
        arrived.push(id)
        if (walker.onArrive) callbacks.push(walker.onArrive)
        continue
      }

      const target = walker.path[0]
      const dx = target.x - walker.currentPos.x
      const dy = target.y - walker.currentPos.y
      const dist = Math.sqrt(dx * dx + dy * dy)

      if (dist < ARRIVE_THRESHOLD) {
        // Reached waypoint
        walker.currentPos = { ...target }
        walker.path.shift()
        if (walker.path.length === 0) {
          arrived.push(id)
          if (walker.onArrive) callbacks.push(walker.onArrive)
        }
        continue
      }

      // Move towards target
      const step = walker.speed * dt
      const ratio = Math.min(step / dist, 1)
      walker.currentPos = {
        x: walker.currentPos.x + dx * ratio,
        y: walker.currentPos.y + dy * ratio,
      }

      // Update facing
      if (Math.abs(dx) > 0.5) {
        walker.facing = dx < 0 ? 'left' : 'right'
      }

      // Update walk frame
      walker.frameTimer += dt
      if (walker.frameTimer >= FRAME_INTERVAL) {
        walker.frameTimer -= FRAME_INTERVAL
        walker.walkFrame = (walker.walkFrame + 1) % 4
      }
    }

    // Remove arrived walkers
    for (const id of arrived) {
      newWalkers.delete(id)
    }

    set({ walkers: newWalkers })

    // Fire callbacks after state update
    for (const cb of callbacks) {
      cb()
    }
  },

  getPosition: (agentId) => {
    const walker = get().walkers.get(agentId)
    return walker ? { ...walker.currentPos } : null
  },

  isWalking: (agentId) => get().walkers.has(agentId),

  getWalkFrame: (agentId) => {
    const walker = get().walkers.get(agentId)
    return walker ? walker.walkFrame : 0
  },

  getFacing: (agentId) => {
    const walker = get().walkers.get(agentId)
    return walker ? walker.facing : 'right'
  },
}))
