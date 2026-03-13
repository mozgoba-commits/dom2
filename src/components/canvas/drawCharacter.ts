// Procedural chibi pixel-art character renderer
// Characters are ~16x24 native pixels, big-head style (head ≈ 40% height)

import type { Mood } from '../../engine/types'
import type { CharacterAppearance } from './spriteConfig'
import type { AnimationState } from '../../store/animationStore'

const OUTLINE = '#111122'

// ─── Main draw function ──────────────────────────────────────

export function drawCharacter(
  ctx: CanvasRenderingContext2D,
  cx: number,  // bottom-center x (between feet)
  cy: number,  // bottom-center y (feet bottom)
  config: CharacterAppearance,
  mood: Mood,
  name: string,
  isSelected: boolean = false,
  walkFrame?: number,  // 0-3: walking animation frame, undefined = standing
  facing?: 'left' | 'right',
  animState?: AnimationState,
  animFrame?: number,
  idlePhase?: number,
  idleLookDir?: 'center' | 'left' | 'right',
) {
  const {
    skinColor, hairColor, hairStyle, shirtColor, pantsColor,
    bodyBuild, accessory, gender,
  } = config

  // Mirror for facing left
  const mirror = facing === 'left'
  if (mirror) {
    ctx.save()
    ctx.translate(cx * 2, 0)
    ctx.scale(-1, 1)
  }

  const isWalking = walkFrame !== undefined
  const aState = animState ?? 'idle'
  const aFrame = animFrame ?? 0

  // Idle breathing: Y-bob applied to body/head, NOT feet
  let breathBob = 0
  if (idlePhase !== undefined) {
    if (aState === 'sleeping') {
      breathBob = Math.sin(idlePhase * 0.48) * 1.0 // slower, deeper for sleeping
    } else {
      breathBob = Math.sin(idlePhase) * 0.5
    }
  }

  // Action-specific body offsets
  let bodyLean = 0  // horizontal lean
  let bodyJump = 0  // vertical jump
  let leftArmMod = 0  // arm Y offset modifiers
  let rightArmMod = 0

  if (aState === 'talking') {
    leftArmMod = aFrame % 2 === 1 ? -1 : 0
  } else if (aState === 'arguing') {
    bodyLean = aFrame % 2 === 0 ? -1 : 1
    leftArmMod = -3
    rightArmMod = -3
  } else if (aState === 'flirting') {
    bodyLean = 1 // lean toward partner
  } else if (aState === 'crying') {
    bodyLean = aFrame % 2 === 0 ? -1 : 1 // head shake
    leftArmMod = -5
    rightArmMod = -5
  } else if (aState === 'celebrating') {
    leftArmMod = -5
    rightArmMod = -5
    bodyJump = (aFrame === 0 || aFrame === 2) ? -2 : 0
  } else if (aState === 'shocked') {
    bodyJump = -3
  } else if (aState === 'laughing') {
    bodyLean = aFrame % 2 === 0 ? -1 : 1
  } else if (aState === 'sleeping') {
    breathBob += 1 // head droops down
  }

  // Dimensions
  const headW = 10
  const headH = 8
  const bodyW = bodyBuild === 'muscular' ? 10 : bodyBuild === 'slim' ? 6 : 8
  const bodyH = 6
  const legH = 4

  // Y positions (from bottom up) — breathing bob applies to body+head, not feet
  const bob = Math.round(breathBob + bodyJump)
  const legsTopY = cy - legH
  const bodyTopY = legsTopY - bodyH + bob
  const neckY = bodyTopY - 1
  const headTopY = neckY - headH

  // X positions (with lean)
  const headL = Math.round(cx - headW / 2 + bodyLean)
  const bodyL = Math.round(cx - bodyW / 2 + bodyLean)

  // ── Shadow ──
  ctx.fillStyle = 'rgba(0,0,0,0.2)'
  ctx.beginPath()
  ctx.ellipse(cx, cy + 1, 7, 2, 0, 0, Math.PI * 2)
  ctx.fill()

  // ── Legs / Skirt ──
  // Walk animation offsets: frame 0,2 = neutral, 1 = left up, 3 = right up
  const leftLegOff = isWalking ? (walkFrame === 1 ? -2 : walkFrame === 3 ? 1 : 0) : 0
  const rightLegOff = isWalking ? (walkFrame === 3 ? -2 : walkFrame === 1 ? 1 : 0) : 0

  if (gender === 'female') {
    // Skirt — expanding trapezoid
    const skirtSway = isWalking ? (walkFrame === 1 ? 1 : walkFrame === 3 ? -1 : 0) : 0
    for (let row = 0; row < legH; row++) {
      const w = bodyW + Math.floor(row * 4 / legH)
      const x = Math.round(cx - w / 2) + (row > 1 ? skirtSway : 0)
      px(ctx, x - 1, legsTopY + row, w + 2, 1, OUTLINE)
      px(ctx, x, legsTopY + row, w, 1, pantsColor)
    }
    // Tiny feet (with walk offset)
    px(ctx, cx - 3, cy - 1 + leftLegOff, 2, 1, skinColor)
    px(ctx, cx + 1, cy - 1 + rightLegOff, 2, 1, skinColor)
  } else {
    // Two separate legs
    const gap = bodyBuild === 'slim' ? 1 : 2
    const legW = 2
    const leftX = Math.round(cx - gap / 2 - legW)
    const rightX = Math.round(cx + gap / 2)
    // Outline
    px(ctx, leftX - 1, legsTopY - 1 + leftLegOff, legW + 2, legH + 2, OUTLINE)
    px(ctx, rightX - 1, legsTopY - 1 + rightLegOff, legW + 2, legH + 2, OUTLINE)
    // Fill
    px(ctx, leftX, legsTopY + leftLegOff, legW, legH, pantsColor)
    px(ctx, rightX, legsTopY + rightLegOff, legW, legH, pantsColor)
    // Shoes
    px(ctx, leftX, cy - 1 + leftLegOff, legW, 1, '#2c2c3e')
    px(ctx, rightX, cy - 1 + rightLegOff, legW, 1, '#2c2c3e')
  }

  // ── Body (torso) ──
  px(ctx, bodyL - 1, bodyTopY - 1, bodyW + 2, bodyH + 2, OUTLINE)
  px(ctx, bodyL, bodyTopY, bodyW, bodyH, shirtColor)
  // Shirt center seam
  px(ctx, cx - 1, bodyTopY + 1, 1, bodyH - 2, darken(shirtColor, 25))
  // Arms (small stubs) — swing opposite to legs when walking, + action modifiers
  const leftArmOff = (isWalking ? (walkFrame === 3 ? -1 : walkFrame === 1 ? 1 : 0) : 0) + leftArmMod
  const rightArmOff = (isWalking ? (walkFrame === 1 ? -1 : walkFrame === 3 ? 1 : 0) : 0) + rightArmMod
  px(ctx, bodyL - 2, bodyTopY + 1 + leftArmOff, 2, 3, skinColor)
  px(ctx, bodyL + bodyW, bodyTopY + 1 + rightArmOff, 2, 3, skinColor)
  // Arm outline
  px(ctx, bodyL - 3, bodyTopY + leftArmOff, 1, 5, OUTLINE)
  px(ctx, bodyL + bodyW + 2, bodyTopY + rightArmOff, 1, 5, OUTLINE)

  // ── Neck ──
  px(ctx, cx - 1, neckY, 2, 1, skinColor)

  // ── Head ──
  px(ctx, headL - 1, headTopY - 1, headW + 2, headH + 2, OUTLINE)
  px(ctx, headL, headTopY, headW, headH, skinColor)

  // ── Hair ──
  drawHair(ctx, cx, headTopY, headW, headH, headL, hairColor, hairStyle)

  // ── Eyes (mood-based, with animation overrides) ──
  const eyeMood = aState === 'arguing' ? 'angry' as Mood
    : aState === 'flirting' ? 'flirty' as Mood
    : aState === 'sleeping' ? 'bored' as Mood
    : aState === 'crying' ? 'devastated' as Mood
    : aState === 'celebrating' ? 'happy' as Mood
    : aState === 'shocked' ? 'anxious' as Mood
    : aState === 'laughing' ? 'happy' as Mood
    : mood
  // Idle look direction: shift eye X
  const lookShift = idleLookDir === 'left' ? -1 : idleLookDir === 'right' ? 1 : 0
  drawEyes(ctx, cx + bodyLean + lookShift, headTopY, headH, eyeMood)

  // ── Mouth (with animation overrides) ──
  const mouthY = headTopY + Math.floor(headH * 0.75)
  const mouthCx = cx + bodyLean
  if (aState === 'talking') {
    // Alternating open/close
    if (aFrame % 2 === 0) {
      px(ctx, mouthCx - 1, mouthY, 3, 2, '#993333') // open
    } else {
      px(ctx, mouthCx - 1, mouthY, 2, 1, '#993333') // closed
    }
  } else if (aState === 'arguing') {
    px(ctx, mouthCx - 2, mouthY, 4, 2, '#cc2222') // wide open red
  } else if (aState === 'laughing') {
    px(ctx, mouthCx - 1, mouthY, 3, 2, '#cc5555') // wide open
  } else if (aState === 'shocked') {
    // O-shape
    px(ctx, mouthCx - 1, mouthY, 2, 2, '#993366')
    px(ctx, mouthCx, mouthY + 1, 1, 1, skinColor) // hollow center
  } else if (aState === 'sleeping') {
    px(ctx, mouthCx - 1, mouthY, 2, 1, '#666688') // closed line
  } else if (aState === 'celebrating') {
    px(ctx, mouthCx - 2, mouthY, 4, 1, '#cc5555') // big smile
  } else if (aState === 'crying') {
    px(ctx, mouthCx - 1, mouthY + 1, 3, 1, '#666688') // frown
  } else if (aState === 'flirting') {
    px(ctx, mouthCx - 1, mouthY, 2, 1, '#cc5555') // small smile
    // Blush on cheeks
    px(ctx, mouthCx - 4, mouthY - 1, 2, 1, '#ffaaaa')
    px(ctx, mouthCx + 3, mouthY - 1, 2, 1, '#ffaaaa')
  } else if (aState === 'eating') {
    // Chew cycle
    if (aFrame % 2 === 0) {
      px(ctx, mouthCx - 1, mouthY, 2, 1, '#993333')
    } else {
      px(ctx, mouthCx - 1, mouthY, 2, 2, '#993333')
    }
    // Food square at right hand
    px(ctx, bodyL + bodyW + 2, bodyTopY + rightArmOff + 1, 2, 2, '#cc8833')
  } else if (mood === 'happy' || mood === 'excited' || mood === 'euphoric') {
    px(ctx, mouthCx - 1, mouthY, 3, 1, '#cc5555') // smile
  } else if (mood === 'sad' || mood === 'devastated') {
    px(ctx, mouthCx - 1, mouthY + 1, 3, 1, '#666688') // frown
  } else if (mood === 'angry') {
    px(ctx, mouthCx - 1, mouthY, 2, 1, '#993333') // tight line
  }

  // ── Accessories ──
  if (accessory === 'glasses') {
    const eyeY = headTopY + Math.floor(headH * 0.35)
    px(ctx, cx - 5, eyeY - 1, 4, 3, 'rgba(100,120,150,0.6)')
    px(ctx, cx + 1, eyeY - 1, 4, 3, 'rgba(100,120,150,0.6)')
    px(ctx, cx - 1, eyeY, 2, 1, '#667788') // bridge
  }
  if (accessory === 'beard') {
    px(ctx, cx - 3, headTopY + headH - 2, 6, 3, hairColor)
    px(ctx, cx - 2, headTopY + headH + 1, 4, 1, darken(hairColor, 20))
  }
  if (accessory === 'earring') {
    px(ctx, headL - 1, headTopY + Math.floor(headH * 0.5), 1, 2, '#ffd700')
  }
  if (accessory === 'bow') {
    px(ctx, headL + headW - 2, headTopY - 2, 4, 3, '#ff4488')
    px(ctx, headL + headW - 1, headTopY - 1, 2, 1, '#ff6699')
  }

  // ── Action indicator above head ──
  if (aState !== 'idle' && aState !== 'walking') {
    drawActionIndicator(ctx, cx + bodyLean, headTopY + bob - 6, aState)
  }

  // ── Selection indicator ──
  if (isSelected) {
    ctx.strokeStyle = config.accentColor
    ctx.lineWidth = 0.5
    ctx.setLineDash([2, 1])
    const boxTop = headTopY - 4
    const boxH = cy - boxTop + 3
    ctx.strokeRect(cx - 9, boxTop, 18, boxH)
    ctx.setLineDash([])

    // Small arrow above head
    ctx.fillStyle = config.accentColor
    ctx.beginPath()
    ctx.moveTo(cx - 2, headTopY - 6)
    ctx.lineTo(cx + 2, headTopY - 6)
    ctx.lineTo(cx, headTopY - 4)
    ctx.fill()
  }

  // ── Name label ──
  ctx.font = '4px monospace'
  ctx.textAlign = 'center'
  ctx.fillStyle = '#000000'
  ctx.fillText(name, cx + 0.5, cy + 7.5) // shadow
  ctx.fillStyle = '#ffffff'
  ctx.fillText(name, cx, cy + 7)

  // Restore mirror transform
  if (mirror) {
    ctx.restore()
  }
}

// ─── Hair styles ─────────────────────────────────────────────

function drawHair(
  ctx: CanvasRenderingContext2D,
  cx: number, headTopY: number,
  headW: number, headH: number, headL: number,
  color: string, style: string,
) {
  switch (style) {
    case 'bald':
      // Thin stubble on top
      px(ctx, headL + 1, headTopY, headW - 2, 1, darken(color, 10))
      break

    case 'short':
      // Covers top 3 rows
      px(ctx, headL - 1, headTopY - 2, headW + 2, 4, OUTLINE)
      px(ctx, headL, headTopY - 1, headW, 3, color)
      break

    case 'medium':
      // Top + sides
      px(ctx, headL - 2, headTopY - 2, headW + 4, 5, OUTLINE)
      px(ctx, headL - 1, headTopY - 1, headW + 2, 4, color)
      // Side hair
      px(ctx, headL - 2, headTopY + 1, 2, headH - 3, OUTLINE)
      px(ctx, headL - 1, headTopY + 1, 1, headH - 3, color)
      px(ctx, headL + headW, headTopY + 1, 2, headH - 3, OUTLINE)
      px(ctx, headL + headW, headTopY + 1, 1, headH - 3, color)
      break

    case 'long':
      // Full coverage top + long sides past head
      px(ctx, headL - 2, headTopY - 3, headW + 4, 5, OUTLINE)
      px(ctx, headL - 1, headTopY - 2, headW + 2, 4, color)
      // Long side hair (past head height)
      px(ctx, headL - 3, headTopY, 3, headH + 4, OUTLINE)
      px(ctx, headL - 2, headTopY, 2, headH + 3, color)
      px(ctx, headL + headW, headTopY, 3, headH + 4, OUTLINE)
      px(ctx, headL + headW, headTopY, 2, headH + 3, color)
      break

    case 'curly':
      // Puffy cloud-like hair
      px(ctx, headL - 3, headTopY - 3, headW + 6, 6, OUTLINE)
      px(ctx, headL - 2, headTopY - 2, headW + 4, 5, color)
      // Highlight curls
      const lighter = lighten(color, 40)
      px(ctx, headL - 1, headTopY - 2, 2, 1, lighter)
      px(ctx, headL + headW - 1, headTopY - 2, 2, 1, lighter)
      px(ctx, headL + 2, headTopY - 3, 2, 1, lighter)
      // Side curls
      px(ctx, headL - 3, headTopY + 1, 3, headH - 2, OUTLINE)
      px(ctx, headL - 2, headTopY + 1, 2, headH - 2, color)
      px(ctx, headL + headW, headTopY + 1, 3, headH - 2, OUTLINE)
      px(ctx, headL + headW, headTopY + 1, 2, headH - 2, color)
      break

    case 'ponytail':
      // Short on top + ponytail extending right
      px(ctx, headL - 1, headTopY - 2, headW + 2, 4, OUTLINE)
      px(ctx, headL, headTopY - 1, headW, 3, color)
      // Ponytail (extends right and down)
      px(ctx, headL + headW, headTopY + 1, 5, 2, OUTLINE)
      px(ctx, headL + headW + 3, headTopY + 3, 3, 5, OUTLINE)
      px(ctx, headL + headW + 1, headTopY + 1, 3, 1, color)
      px(ctx, headL + headW + 4, headTopY + 3, 1, 4, color)
      // Hair band
      px(ctx, headL + headW + 2, headTopY + 2, 2, 1, '#ff4488')
      break
  }
}

// ─── Eye expressions ─────────────────────────────────────────

function drawEyes(
  ctx: CanvasRenderingContext2D,
  cx: number, headTopY: number, headH: number,
  mood: Mood,
) {
  const eyeY = headTopY + Math.floor(headH * 0.38)
  const lx = cx - 3 // left eye x
  const rx = cx + 2  // right eye x

  switch (mood) {
    case 'happy':
    case 'excited':
    case 'euphoric':
      // Happy arches: ^  ^
      ctx.fillStyle = '#111122'
      // Left eye arch
      px(ctx, lx, eyeY, 2, 1, '#111122')
      px(ctx, lx - 1, eyeY - 1, 1, 1, '#111122')
      px(ctx, lx + 2, eyeY - 1, 1, 1, '#111122')
      // Right eye arch
      px(ctx, rx, eyeY, 2, 1, '#111122')
      px(ctx, rx - 1, eyeY - 1, 1, 1, '#111122')
      px(ctx, rx + 2, eyeY - 1, 1, 1, '#111122')
      break

    case 'angry':
    case 'annoyed':
      // Angry slashes: \  /
      px(ctx, lx, eyeY, 2, 1, '#cc2222')
      px(ctx, lx + 2, eyeY - 1, 1, 1, '#cc2222') // brow
      px(ctx, rx, eyeY, 2, 1, '#cc2222')
      px(ctx, rx - 1, eyeY - 1, 1, 1, '#cc2222') // brow
      break

    case 'sad':
    case 'devastated':
      // Droopy eyes, shifted down
      px(ctx, lx, eyeY + 1, 2, 1, '#4444aa')
      px(ctx, lx - 1, eyeY, 1, 1, '#4444aa')
      px(ctx, rx, eyeY + 1, 2, 1, '#4444aa')
      px(ctx, rx + 2, eyeY, 1, 1, '#4444aa')
      // Tear
      if (mood === 'devastated') {
        px(ctx, lx, eyeY + 2, 1, 1, '#6688cc')
      }
      break

    case 'flirty':
      // Wink: one eye open, one closed
      px(ctx, lx, eyeY, 2, 2, '#cc4488') // open (heart-ish)
      px(ctx, rx, eyeY + 1, 2, 1, '#111122') // closed (line)
      break

    case 'scheming':
      // Tiny dots: · ·
      px(ctx, lx + 1, eyeY + 1, 1, 1, '#111122')
      px(ctx, rx, eyeY + 1, 1, 1, '#111122')
      break

    case 'jealous':
      // Narrowed eyes
      px(ctx, lx, eyeY + 1, 2, 1, '#886622')
      px(ctx, lx, eyeY, 2, 1, '#886622')
      px(ctx, rx, eyeY + 1, 2, 1, '#886622')
      px(ctx, rx, eyeY, 2, 1, '#886622')
      break

    case 'anxious':
      // Wide eyes (bigger squares)
      px(ctx, lx - 1, eyeY - 1, 3, 3, '#111122')
      px(ctx, lx, eyeY, 1, 1, '#ffffff') // highlight
      px(ctx, rx - 1, eyeY - 1, 3, 3, '#111122')
      px(ctx, rx, eyeY, 1, 1, '#ffffff')
      break

    case 'bored':
      // Half-closed (horizontal lines)
      px(ctx, lx, eyeY + 1, 2, 1, '#555566')
      px(ctx, rx, eyeY + 1, 2, 1, '#555566')
      break

    default:
      // Normal square eyes (neutral, etc.)
      px(ctx, lx, eyeY, 2, 2, '#111122')
      px(ctx, rx, eyeY, 2, 2, '#111122')
      // Small white highlight
      px(ctx, lx, eyeY, 1, 1, '#334455')
      px(ctx, rx, eyeY, 1, 1, '#334455')
      break
  }
}

// ─── Action indicator icons ──────────────────────────────────

function drawActionIndicator(
  ctx: CanvasRenderingContext2D,
  cx: number, topY: number,
  animState: AnimationState,
) {
  const x = cx - 2
  const y = topY - 5

  switch (animState) {
    case 'talking':
      // Three radiating lines (speech)
      ctx.fillStyle = '#cccccc'
      px(ctx, x, y, 1, 1, '#cccccc')
      px(ctx, x + 2, y - 1, 1, 1, '#cccccc')
      px(ctx, x + 3, y + 1, 1, 1, '#cccccc')
      break
    case 'arguing':
      // Exclamation mark (red)
      px(ctx, cx, y - 1, 1, 3, '#ff3333')
      px(ctx, cx, y + 3, 1, 1, '#ff3333')
      break
    case 'flirting':
      // Tiny heart (pink)
      px(ctx, cx - 1, y, 1, 1, '#ff6688')
      px(ctx, cx + 1, y, 1, 1, '#ff6688')
      px(ctx, cx, y + 1, 1, 1, '#ff6688')
      break
    case 'eating':
      // Cross shape (fork)
      px(ctx, cx, y - 1, 1, 3, '#ccaa55')
      px(ctx, cx - 1, y, 3, 1, '#ccaa55')
      break
    case 'sleeping':
      // Crescent moon
      px(ctx, cx - 1, y - 1, 3, 1, '#aabbdd')
      px(ctx, cx - 2, y, 1, 2, '#aabbdd')
      px(ctx, cx - 1, y + 2, 3, 1, '#aabbdd')
      break
    case 'thinking':
      // Three dots
      px(ctx, cx - 2, y + 1, 1, 1, '#aaaaaa')
      px(ctx, cx, y + 1, 1, 1, '#aaaaaa')
      px(ctx, cx + 2, y + 1, 1, 1, '#aaaaaa')
      break
    case 'crying':
      // Tear drop
      px(ctx, cx, y, 1, 1, '#6688cc')
      px(ctx, cx, y + 1, 1, 2, '#6688cc')
      break
    case 'celebrating':
      // Star burst
      px(ctx, cx, y - 1, 1, 3, '#ffee66')
      px(ctx, cx - 1, y, 3, 1, '#ffee66')
      break
    case 'laughing':
      // Ha ha
      ctx.fillStyle = '#cccccc'
      ctx.font = '3px monospace'
      ctx.fillText('x)', cx - 2, y + 2)
      break
  }
}

// ─── Helpers ─────────────────────────────────────────────────

function px(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

function darken(hex: string, amount: number): string {
  if (hex.startsWith('rgba')) return hex
  const r = Math.max(0, parseInt(hex.slice(1, 3), 16) - amount)
  const g = Math.max(0, parseInt(hex.slice(3, 5), 16) - amount)
  const b = Math.max(0, parseInt(hex.slice(5, 7), 16) - amount)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}

function lighten(hex: string, amount: number): string {
  if (hex.startsWith('rgba')) return hex
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
