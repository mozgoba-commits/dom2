'use client'

import { useRef, useEffect, useCallback } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { useViewStore } from '../../store/viewStore'
import { useWalkingStore } from '../../store/walkingStore'
import { useAnimationStore } from '../../store/animationStore'
import type { LocationId } from '../../engine/types'
import { drawCharacter } from './drawCharacter'
import { drawEnvironment } from './drawEnvironment'
import { getAppearance } from './spriteConfig'
import { emitParticles, tickParticles, drawParticles } from './particleSystem'
import { clampToWalkable } from './collisionMap'

// ─── Layout constants (exported for SpeechBubbles) ──────────

export const NATIVE_W = 480
export const NATIVE_H = 360
export const SCALE = 3

export const LOCATIONS: Record<LocationId, { x: number; y: number; w: number; h: number; label: string; color: string }> = {
  yard:         { x: 0,   y: 0,   w: 480, h: 130, label: 'Поляна',        color: '#4a7c3f' },
  bedroom:      { x: 0,   y: 133, w: 157, h: 147, label: 'Спальня',       color: '#3a3550' },
  living_room:  { x: 160, y: 133, w: 157, h: 147, label: 'Гостиная',      color: '#5c4a32' },
  kitchen:      { x: 320, y: 133, w: 160, h: 147, label: 'Кухня',         color: '#c4a35a' },
  bathroom:     { x: 0,   y: 283, w: 157, h: 77,  label: 'Ванная',        color: '#2a4a5a' },
  confessional: { x: 160, y: 283, w: 157, h: 77,  label: 'Конфессионная',  color: '#3a1a1a' },
}

// Old layout bases (server sends positions in this coordinate space)
const OLD_LOCATIONS: Record<LocationId, { x: number; y: number; w: number; h: number }> = {
  yard:         { x: 0,   y: 0,   w: 320, h: 90  },
  bedroom:      { x: 0,   y: 90,  w: 100, h: 100 },
  living_room:  { x: 100, y: 90,  w: 120, h: 100 },
  kitchen:      { x: 220, y: 90,  w: 100, h: 100 },
  bathroom:     { x: 0,   y: 190, w: 100, h: 50  },
  confessional: { x: 100, y: 190, w: 120, h: 50  },
}

// Map server positions to new layout
export function remapPosition(
  location: LocationId,
  pos: { x: number; y: number },
): { x: number; y: number } {
  const oldLoc = OLD_LOCATIONS[location]
  const newLoc = LOCATIONS[location]
  if (!oldLoc || !newLoc) return pos

  // Relative position in old room (0–1), clamped
  const relX = Math.max(0.12, Math.min(0.88, (pos.x - oldLoc.x) / oldLoc.w))
  const relY = Math.max(0.18, Math.min(0.82, (pos.y - oldLoc.y) / oldLoc.h))

  return {
    x: Math.round(newLoc.x + relX * newLoc.w),
    y: Math.round(newLoc.y + relY * newLoc.h),
  }
}

// ─── Component ───────────────────────────────────────────────

export default function HouseScene() {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const animRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(0)

  const agents = useSimulationStore(s => s.agents)
  const clock = useSimulationStore(s => s.clock)
  const selectedAgentId = useSimulationStore(s => s.selectedAgentId)
  const setSelectedAgent = useSimulationStore(s => s.setSelectedAgent)
  const focusedLocation = useViewStore(s => s.focusedLocation)

  const walkingStore = useWalkingStore
  const animationStore = useAnimationStore

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = NATIVE_W * SCALE
    canvas.height = NATIVE_H * SCALE
    ctx.imageSmoothingEnabled = false
    ctx.scale(SCALE, SCALE)

    // Clear background (exterior / void)
    ctx.fillStyle = '#1a1a2e'
    ctx.fillRect(0, 0, NATIVE_W, NATIVE_H)

    // Draw all rooms (floors, furniture, decorations, walls)
    drawEnvironment(ctx, LOCATIONS, clock?.timeOfDay, clock?.hour)

    // Dimming for unfocused locations
    if (focusedLocation) {
      for (const [id, loc] of Object.entries(LOCATIONS)) {
        if (id !== focusedLocation) {
          ctx.fillStyle = 'rgba(0,0,0,0.55)'
          ctx.fillRect(loc.x, loc.y, loc.w, loc.h)
        }
      }
    }

    // Night character glow
    const isNight = clock?.timeOfDay === 'night'

    // Draw agents (sorted by Y for z-order)
    const getAgentPos = (agent: typeof agents[0]) => {
      const walkPos = walkingStore.getState().getPosition(agent.id)
      if (walkPos) return walkPos
      const remapped = remapPosition(agent.location, agent.position)
      return clampToWalkable(agent.location, remapped.x, remapped.y)
    }

    const sortedAgents = [...agents].sort((a, b) => {
      return getAgentPos(a).y - getAgentPos(b).y
    })

    // Collect paired agents for interaction auras
    const pairedAgents: Array<{ a: typeof agents[0]; b: typeof agents[0]; state: string }> = []

    for (const agent of sortedAgents) {
      const pos = getAgentPos(agent)
      const appearance = getAppearance(agent.name)
      const isSelected = agent.id === selectedAgentId
      const ws = walkingStore.getState()
      const as = animationStore.getState()
      const anim = as.getAnimation(agent.id)
      const walking = ws.isWalking(agent.id)
      const walkFrame = walking ? ws.getWalkFrame(agent.id) : undefined
      // Use facing override from animation (face partner) over walking facing
      const facing = anim.facingOverride ?? (walking ? ws.getFacing(agent.id) : undefined)

      // Night: subtle bright outline so characters are visible
      if (isNight) {
        ctx.strokeStyle = 'rgba(255,255,255,0.15)'
        ctx.lineWidth = 0.5
        ctx.strokeRect(pos.x - 8, pos.y - 22, 16, 24)
      }

      drawCharacter(
        ctx, pos.x, pos.y, appearance, agent.mood, agent.name, isSelected,
        walkFrame, facing,
        anim.state, anim.actionFrame, anim.idlePhase, anim.idleLookDirection,
      )

      // Emit particles based on animation state
      const headY = pos.y - 20
      if (anim.state === 'arguing') emitParticles('anger', pos.x, headY)
      else if (anim.state === 'flirting') emitParticles('heart', pos.x, headY - 4)
      else if (anim.state === 'crying') emitParticles('tear', pos.x - 2, headY + 4)
      else if (anim.state === 'sleeping') emitParticles('zzz', pos.x + 5, headY - 2)
      else if (anim.state === 'celebrating') emitParticles('sparkle', pos.x, headY - 6)

      // Track paired agents for auras
      if (anim.actionTarget && (anim.state === 'arguing' || anim.state === 'flirting' || anim.state === 'talking')) {
        const partner = sortedAgents.find(a => a.id === anim.actionTarget)
        if (partner && !pairedAgents.some(p =>
          (p.a.id === agent.id && p.b.id === partner.id) ||
          (p.a.id === partner.id && p.b.id === agent.id)
        )) {
          pairedAgents.push({ a: agent, b: partner, state: anim.state })
        }
      }
    }

    // Draw interaction auras between paired agents
    for (const pair of pairedAgents) {
      const posA = getAgentPos(pair.a)
      const posB = getAgentPos(pair.b)
      const midX = (posA.x + posB.x) / 2
      const midY = (posA.y + posB.y) / 2
      const dist = Math.sqrt((posA.x - posB.x) ** 2 + (posA.y - posB.y) ** 2)
      const rx = dist / 2 + 5
      const ry = 8

      ctx.beginPath()
      ctx.ellipse(midX, midY - 5, rx, ry, 0, 0, Math.PI * 2)
      if (pair.state === 'arguing') {
        ctx.fillStyle = 'rgba(255,50,50,0.06)'
      } else if (pair.state === 'flirting') {
        ctx.fillStyle = 'rgba(255,100,150,0.05)'
      } else {
        ctx.fillStyle = 'rgba(200,200,255,0.03)'
      }
      ctx.fill()
    }

    // Draw particles on top
    drawParticles(ctx)
  }, [agents, focusedLocation, selectedAgentId, clock, walkingStore, animationStore])

  // rAF animation loop
  useEffect(() => {
    const loop = (time: number) => {
      const dt = lastTimeRef.current === 0 ? 0.016 : Math.min((time - lastTimeRef.current) / 1000, 0.1)
      lastTimeRef.current = time

      walkingStore.getState().tick(dt)
      animationStore.getState().tick(dt)
      tickParticles(dt)
      draw()

      animRef.current = requestAnimationFrame(loop)
    }
    animRef.current = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(animRef.current)
  }, [draw, walkingStore, animationStore])

  // Auto-scroll to followed (selected) agent
  useEffect(() => {
    if (!selectedAgentId || !canvasRef.current) return
    const agent = agents.find(a => a.id === selectedAgentId)
    if (!agent) return

    const pos = remapPosition(agent.location, agent.position)
    const screenX = pos.x * SCALE
    const screenY = pos.y * SCALE

    // Find scrollable ancestor
    let container = canvasRef.current.parentElement
    while (container) {
      const style = getComputedStyle(container)
      if (style.overflow === 'auto' || style.overflowY === 'auto' || style.overflow === 'scroll') break
      container = container.parentElement
    }
    if (!container) return

    container.scrollTo({
      left: screenX - container.clientWidth / 2,
      top: screenY - container.clientHeight / 2,
      behavior: 'smooth',
    })
  }, [selectedAgentId, agents])

  const hitTestAgent = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    const x = (clientX - rect.left) / SCALE
    const y = (clientY - rect.top) / SCALE

    for (const agent of agents) {
      const walkPos = walkingStore.getState().getPosition(agent.id)
      const pos = walkPos ?? remapPosition(agent.location, agent.position)
      if (Math.abs(x - pos.x) < 10 && Math.abs(y - pos.y) < 14) {
        if (agent.id === selectedAgentId) {
          setSelectedAgent(null)
        } else {
          setSelectedAgent(agent.id)
        }
        return
      }
    }
    setSelectedAgent(null)
  }

  const handleClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
    hitTestAgent(e.clientX, e.clientY)
  }

  // Touch support for mobile
  const handleTouchEnd = (e: React.TouchEvent<HTMLCanvasElement>) => {
    if (e.changedTouches.length === 1) {
      const touch = e.changedTouches[0]
      hitTestAgent(touch.clientX, touch.clientY)
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onClick={handleClick}
      onTouchEnd={handleTouchEnd}
      className="cursor-pointer border border-gray-700 rounded-lg touch-manipulation"
      style={{
        width: NATIVE_W * SCALE,
        height: NATIVE_H * SCALE,
        imageRendering: 'pixelated',
      }}
    />
  )
}
