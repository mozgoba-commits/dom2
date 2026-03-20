'use client'

import { useRef, useEffect, useCallback, useState } from 'react'
import { useSimulationStore } from '../../store/simulationStore'
import { useViewStore } from '../../store/viewStore'
import { useWalkingStore } from '../../store/walkingStore'
import { useAnimationStore } from '../../store/animationStore'
import type { LocationId } from '../../engine/types'
import { remapPosition } from '../../engine/coordinates'
import { drawCharacter } from './drawCharacter'
import { drawEnvironment } from './drawEnvironment'
import { getAppearance } from './spriteConfig'
import { emitParticles, tickParticles, drawParticles } from './particleSystem'
import { clampToWalkable } from '../../engine/collisionMap'

// ─── Bed center positions in native canvas coords ───────────
// Must match drawBed() calls in drawEnvironment.ts
// Bedroom r = { x: 0, y: 133, w: 157, h: 147 }
const BED_CENTERS = [
  { x: 6 + 17, y: 133 + 14 + 8 },   // bed 1 top-left (blue)
  { x: 6 + 17, y: 133 + 147 - 30 + 8 }, // bed 2 bottom-left (pink)
  { x: 157 - 42 + 17, y: 133 + 14 + 8 }, // bed 3 top-right (green)
  { x: 157 - 42 + 17, y: 133 + 147 - 30 + 8 }, // bed 4 bottom-right (purple)
]

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

    // Cache agent positions (computed once, reused for sort + draw + auras)
    const ws = walkingStore.getState()
    const as = animationStore.getState()
    const positionCache = new Map<string, { x: number; y: number }>()
    let bedIdx = 0
    for (const agent of agents) {
      const isWalking = ws.isWalking(agent.id)
      const walkPos = isWalking ? ws.getPosition(agent.id) : null

      if (walkPos) {
        // Walking takes priority — never snap to bed mid-walk
        positionCache.set(agent.id, walkPos)
      } else if (agent.status === 'sleeping' && agent.location === 'bedroom') {
        // Sleeping and done walking → place on bed
        const bed = BED_CENTERS[bedIdx % BED_CENTERS.length]
        bedIdx++
        positionCache.set(agent.id, bed)
      } else {
        const remapped = remapPosition(agent.location, agent.position)
        positionCache.set(agent.id, clampToWalkable(agent.location, remapped.x, remapped.y))
      }
    }

    const sortedAgents = [...agents].sort((a, b) => {
      return positionCache.get(a.id)!.y - positionCache.get(b.id)!.y
    })

    // Collect paired agents for interaction auras
    const pairedAgents: Array<{ a: typeof agents[0]; b: typeof agents[0]; state: string }> = []

    for (const agent of sortedAgents) {
      const pos = positionCache.get(agent.id)!
      const appearance = getAppearance(agent.name)
      const isSelected = agent.id === selectedAgentId
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
      const posA = positionCache.get(pair.a.id)!
      const posB = positionCache.get(pair.b.id)!
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

  const isConnected = useSimulationStore(s => s.isConnected)
  const [shareUrl, setShareUrl] = useState<string | null>(null)

  const handleScreenshot = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const url = canvas.toDataURL('image/png')
    setShareUrl(url)
  }

  // Loading overlay
  const showLoading = !isConnected || agents.length === 0

  return (
    <div className="relative">
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

      {/* Loading overlay */}
      {showLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/60 rounded-lg">
          <div className="text-center">
            <p className="text-white text-lg font-bold animate-pulse">
              Connecting to Big Brother AI...
            </p>
            <p className="text-gray-400 text-sm mt-2">Подключение к симуляции</p>
          </div>
        </div>
      )}

      {/* Camera button */}
      {!showLoading && (
        <button
          onClick={handleScreenshot}
          className="absolute top-2 right-2 bg-black/50 hover:bg-black/70 text-white text-xs px-2 py-1 rounded transition-colors"
          title="Скриншот"
        >
          [cam]
        </button>
      )}

      {/* Share modal */}
      {shareUrl && (
        <ShareModalInline imageUrl={shareUrl} onClose={() => setShareUrl(null)} />
      )}
    </div>
  )
}

function ShareModalInline({ imageUrl, onClose }: { imageUrl: string; onClose: () => void }) {
  const handleDownload = () => {
    const a = document.createElement('a')
    a.href = imageUrl
    a.download = 'dom2-screenshot.png'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
  }

  return (
    <div className="absolute inset-0 bg-black/80 flex items-center justify-center rounded-lg z-10" onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-lg p-3 max-w-xs" onClick={e => e.stopPropagation()}>
        <img src={imageUrl} alt="Screenshot" className="w-full rounded mb-2" style={{ imageRendering: 'pixelated' }} />
        <div className="flex gap-2">
          <button onClick={handleDownload} className="flex-1 py-1 bg-gray-800 text-white text-xs rounded hover:bg-gray-700">
            Скачать
          </button>
          <button onClick={onClose} className="px-2 py-1 text-gray-500 text-xs hover:text-gray-300">
            Закрыть
          </button>
        </div>
      </div>
    </div>
  )
}
