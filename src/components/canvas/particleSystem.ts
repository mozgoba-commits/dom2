// Flat-array particle system for pixel-art effects
// Max 200 particles globally

export type ParticleType = 'heart' | 'anger' | 'tear' | 'zzz' | 'sparkle' | 'sweat'

interface Particle {
  type: ParticleType
  x: number
  y: number
  vx: number
  vy: number
  life: number
  maxLife: number
  active: boolean
}

const MAX_PARTICLES = 200
const particles: Particle[] = Array.from({ length: MAX_PARTICLES }, () => ({
  type: 'heart' as ParticleType,
  x: 0, y: 0, vx: 0, vy: 0, life: 0, maxLife: 1, active: false,
}))

// Emitter cooldowns to prevent over-spawning
const emitterTimers: Map<string, number> = new Map()

const PARTICLE_CONFIG: Record<ParticleType, {
  color: string; spawnRate: number; life: number
  vy: [number, number]; vx: [number, number]
}> = {
  heart:   { color: '#ff6688', spawnRate: 0.4, life: 1.2, vy: [-12, -8], vx: [-3, 3] },
  anger:   { color: '#ff3333', spawnRate: 0.3, life: 0.6, vy: [-15, -5], vx: [-10, 10] },
  tear:    { color: '#6688cc', spawnRate: 0.5, life: 0.8, vy: [15, 20], vx: [-1, 1] },
  zzz:     { color: '#aabbdd', spawnRate: 0.8, life: 2.0, vy: [-5, -3], vx: [2, 4] },
  sparkle: { color: '#ffee66', spawnRate: 0.3, life: 0.4, vy: [-10, 10], vx: [-10, 10] },
  sweat:   { color: '#88aacc', spawnRate: 0.6, life: 0.7, vy: [2, 5], vx: [3, 7] },
}

function findInactive(): number {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    if (!particles[i].active) return i
  }
  return -1
}

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min)
}

export function emitParticles(type: ParticleType, cx: number, cy: number) {
  const key = `${type}-${Math.round(cx)}-${Math.round(cy)}`
  const config = PARTICLE_CONFIG[type]
  const now = emitterTimers.get(key) ?? 0
  if (now > 0) return

  emitterTimers.set(key, config.spawnRate)

  const idx = findInactive()
  if (idx < 0) return

  const p = particles[idx]
  p.type = type
  p.x = cx + rand(-3, 3)
  p.y = cy + rand(-2, 2)
  p.vx = rand(config.vx[0], config.vx[1])
  p.vy = rand(config.vy[0], config.vy[1])
  p.life = config.life
  p.maxLife = config.life
  p.active = true
}

export function tickParticles(dt: number) {
  // Update emitter timers
  for (const [key, timer] of emitterTimers) {
    const newTimer = timer - dt
    if (newTimer <= 0) {
      emitterTimers.delete(key)
    } else {
      emitterTimers.set(key, newTimer)
    }
  }

  // Update particles
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = particles[i]
    if (!p.active) continue

    p.life -= dt
    if (p.life <= 0) {
      p.active = false
      continue
    }

    p.x += p.vx * dt
    p.y += p.vy * dt

    // Gravity for tears and sweat
    if (p.type === 'tear' || p.type === 'sweat') {
      p.vy += 20 * dt
    }
  }
}

export function drawParticles(ctx: CanvasRenderingContext2D) {
  for (let i = 0; i < MAX_PARTICLES; i++) {
    const p = particles[i]
    if (!p.active) continue

    const alpha = Math.min(1, p.life / (p.maxLife * 0.3))
    const x = Math.round(p.x)
    const y = Math.round(p.y)

    switch (p.type) {
      case 'heart':
        // 3x3 pixel heart
        ctx.fillStyle = PARTICLE_CONFIG.heart.color
        ctx.globalAlpha = alpha
        ctx.fillRect(x - 1, y, 1, 1)
        ctx.fillRect(x + 1, y, 1, 1)
        ctx.fillRect(x - 2, y - 1, 2, 1)
        ctx.fillRect(x + 1, y - 1, 2, 1)
        ctx.fillRect(x - 1, y + 1, 3, 1)
        ctx.fillRect(x, y + 2, 1, 1)
        ctx.globalAlpha = 1
        break

      case 'anger':
        // 3x3 cross (X shape)
        ctx.fillStyle = PARTICLE_CONFIG.anger.color
        ctx.globalAlpha = alpha
        ctx.fillRect(x - 1, y - 1, 1, 1)
        ctx.fillRect(x + 1, y - 1, 1, 1)
        ctx.fillRect(x, y, 1, 1)
        ctx.fillRect(x - 1, y + 1, 1, 1)
        ctx.fillRect(x + 1, y + 1, 1, 1)
        ctx.globalAlpha = 1
        break

      case 'tear':
        // 1x2 drop
        ctx.fillStyle = PARTICLE_CONFIG.tear.color
        ctx.globalAlpha = alpha
        ctx.fillRect(x, y, 1, 2)
        ctx.globalAlpha = 1
        break

      case 'zzz':
        // Text 'z'
        ctx.fillStyle = PARTICLE_CONFIG.zzz.color
        ctx.globalAlpha = alpha
        ctx.font = '3px monospace'
        ctx.fillText('z', x, y)
        ctx.globalAlpha = 1
        break

      case 'sparkle':
        // 1px flash
        ctx.fillStyle = PARTICLE_CONFIG.sparkle.color
        ctx.globalAlpha = alpha * (Math.random() > 0.5 ? 1 : 0.3)
        ctx.fillRect(x, y, 1, 1)
        ctx.globalAlpha = 1
        break

      case 'sweat':
        // 1x2 drop sideways
        ctx.fillStyle = PARTICLE_CONFIG.sweat.color
        ctx.globalAlpha = alpha
        ctx.fillRect(x, y, 1, 2)
        ctx.globalAlpha = 1
        break
    }
  }
}
