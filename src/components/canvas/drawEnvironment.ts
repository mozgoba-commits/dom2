// Detailed environment renderer for all 5 rooms
// Each room has: floor texture, walls, furniture, decorations

import type { LocationId } from '../../engine/types'

type RoomDef = { x: number; y: number; w: number; h: number }
type Locations = Record<LocationId, RoomDef & { label: string; color: string }>

type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'night'

export function drawEnvironment(
  ctx: CanvasRenderingContext2D,
  locations: Locations,
  timeOfDay?: TimeOfDay,
  hour?: number,
) {
  const tod = timeOfDay ?? 'afternoon'
  const h = hour ?? 14

  // Draw each room
  drawYard(ctx, locations.yard, tod, h)
  drawBedroom(ctx, locations.bedroom, tod, h)
  drawLivingRoom(ctx, locations.living_room, tod, h)
  drawKitchen(ctx, locations.kitchen)
  drawBathroom(ctx, locations.bathroom)
  drawConfessional(ctx, locations.confessional)

  // Draw walls between rooms
  drawWalls(ctx, locations)

  // Draw labels
  for (const [, loc] of Object.entries(locations)) {
    ctx.fillStyle = '#ffffffbb'
    ctx.font = '5px monospace'
    ctx.textAlign = 'center'
    ctx.fillText(loc.label, loc.x + loc.w / 2, loc.y + 9)
  }

  // Apply time-of-day lighting overlays on each room
  applyLighting(ctx, locations, tod, h)
}

// ─── Helper: tiled floor ─────────────────────────────────────

function tiledFloor(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  c1: string, c2: string, size = 4,
) {
  for (let ty = 0; ty < h; ty += size) {
    for (let tx = 0; tx < w; tx += size) {
      ctx.fillStyle = ((Math.floor(tx / size) + Math.floor(ty / size)) % 2 === 0) ? c1 : c2
      ctx.fillRect(x + tx, y + ty, size, size)
    }
  }
}

function px(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, color: string) {
  ctx.fillStyle = color
  ctx.fillRect(Math.round(x), Math.round(y), w, h)
}

// ─── Yard ────────────────────────────────────────────────────

function drawYard(ctx: CanvasRenderingContext2D, r: RoomDef, tod: TimeOfDay = 'afternoon', hour: number = 14) {
  // Grass texture
  tiledFloor(ctx, r.x, r.y, r.w, r.h, '#4a7c3f', '#3d6b35', 4)

  // Random grass tufts (darker spots)
  const seed = 42
  for (let i = 0; i < 30; i++) {
    const gx = r.x + ((seed * (i + 1) * 17) % (r.w - 4))
    const gy = r.y + 14 + ((seed * (i + 1) * 31) % (r.h - 24))
    px(ctx, gx, gy, 2, 1, '#2d5a27')
  }

  // Paths (brown strips connecting doors)
  const pathColor = '#8b7355'
  const pathDark = '#7a644a'
  // Horizontal path across middle
  px(ctx, r.x + 40, r.y + r.h - 12, r.w - 80, 6, pathColor)
  px(ctx, r.x + 40, r.y + r.h - 11, r.w - 80, 1, pathDark)
  // Vertical paths to house doors
  px(ctx, r.x + 75, r.y + r.h - 12, 6, 12, pathColor)   // to bedroom
  px(ctx, r.x + r.w / 2 - 3, r.y + r.h - 12, 6, 12, pathColor) // to living room
  px(ctx, r.x + r.w - 85, r.y + r.h - 12, 6, 12, pathColor) // to kitchen

  // Fence along top
  for (let fx = r.x + 4; fx < r.x + r.w - 4; fx += 8) {
    // Post
    px(ctx, fx, r.y + 3, 2, 8, '#5c4a32')
    px(ctx, fx, r.y + 2, 2, 1, '#6b5a42')
  }
  // Rails
  px(ctx, r.x + 4, r.y + 5, r.w - 8, 1, '#5c4a32')
  px(ctx, r.x + 4, r.y + 9, r.w - 8, 1, '#5c4a32')

  // Campfire (center-ish)
  const cfx = r.x + r.w / 2
  const cfy = r.y + r.h / 2
  // Stone ring
  for (let a = 0; a < 8; a++) {
    const angle = (a / 8) * Math.PI * 2
    const sx = cfx + Math.cos(angle) * 5
    const sy = cfy + Math.sin(angle) * 3
    px(ctx, sx, sy, 2, 2, '#666666')
  }
  // Fire
  px(ctx, cfx - 2, cfy - 3, 4, 4, '#ff6600')
  px(ctx, cfx - 1, cfy - 4, 2, 2, '#ffcc00')
  px(ctx, cfx, cfy - 5, 1, 1, '#ffee66') // spark
  px(ctx, cfx - 3, cfy - 2, 1, 1, '#ffaa00') // ember
  px(ctx, cfx + 2, cfy - 4, 1, 1, '#ffdd44') // spark
  // Logs
  px(ctx, cfx - 4, cfy + 1, 8, 2, '#5c3a1a')
  px(ctx, cfx - 3, cfy - 1, 2, 3, '#4a2e14')

  // Bench 1 (left side)
  drawBench(ctx, r.x + r.w * 0.2, r.y + r.h * 0.4)
  // Bench 2 (right side)
  drawBench(ctx, r.x + r.w * 0.75, r.y + r.h * 0.4)

  // Bushes along edges
  const bushPositions = [
    [r.x + 8, r.y + 15], [r.x + r.w - 18, r.y + 15],
    [r.x + 6, r.y + r.h * 0.7], [r.x + r.w - 16, r.y + r.h * 0.7],
    [r.x + r.w * 0.35, r.y + 14], [r.x + r.w * 0.65, r.y + 14],
  ]
  for (const [bx, by] of bushPositions) {
    drawBush(ctx, bx, by)
  }

  // Lantern (near campfire)
  px(ctx, cfx + 15, cfy - 8, 2, 10, '#888888') // pole
  px(ctx, cfx + 14, cfy - 9, 4, 2, '#aaaaaa')  // top
  px(ctx, cfx + 15, cfy - 10, 2, 1, '#ffee66') // light

  // Time-of-day yard effects
  if (tod === 'morning') {
    // Light blue sky gradient at top
    const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + 14)
    grad.addColorStop(0, 'rgba(135,206,235,0.2)')
    grad.addColorStop(1, 'rgba(135,206,235,0)')
    ctx.fillStyle = grad
    ctx.fillRect(r.x, r.y, r.w, 14)
  } else if (tod === 'evening') {
    // Orange-pink sky
    const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + 14)
    grad.addColorStop(0, 'rgba(255,120,60,0.2)')
    grad.addColorStop(1, 'rgba(255,120,60,0)')
    ctx.fillStyle = grad
    ctx.fillRect(r.x, r.y, r.w, 14)
  } else if (tod === 'night') {
    // Dark blue sky
    const grad = ctx.createLinearGradient(r.x, r.y, r.x, r.y + 14)
    grad.addColorStop(0, 'rgba(10,10,40,0.5)')
    grad.addColorStop(1, 'rgba(10,10,40,0)')
    ctx.fillStyle = grad
    ctx.fillRect(r.x, r.y, r.w, 14)

    // Stars
    ctx.fillStyle = '#ffffff'
    const seed = 137
    for (let i = 0; i < 20; i++) {
      const sx = r.x + 4 + ((seed * (i + 1) * 37) % (r.w - 8))
      const sy = r.y + 2 + ((seed * (i + 1) * 53) % 10)
      const bright = ((seed * (i + 1)) % 3 === 0) ? 1 : 0.6
      ctx.globalAlpha = bright
      ctx.fillRect(Math.round(sx), Math.round(sy), 1, 1)
    }
    ctx.globalAlpha = 1

    // Enhanced campfire glow at night
    ctx.fillStyle = 'rgba(255,150,50,0.15)'
    ctx.beginPath()
    ctx.ellipse(cfx, cfy - 2, 18, 12, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.fillStyle = 'rgba(255,200,80,0.08)'
    ctx.beginPath()
    ctx.ellipse(cfx, cfy - 2, 28, 18, 0, 0, Math.PI * 2)
    ctx.fill()
  }
}

function drawBench(ctx: CanvasRenderingContext2D, x: number, y: number) {
  // Seat
  px(ctx, x, y, 16, 3, '#6b4a2e')
  px(ctx, x, y, 16, 1, '#7d5a3e') // highlight
  // Legs
  px(ctx, x + 1, y + 3, 2, 3, '#4a3520')
  px(ctx, x + 13, y + 3, 2, 3, '#4a3520')
  // Backrest
  px(ctx, x, y - 2, 16, 2, '#5c3a20')
  px(ctx, x, y - 2, 16, 1, '#6b4a30') // highlight
}

function drawBush(ctx: CanvasRenderingContext2D, x: number, y: number) {
  px(ctx, x + 1, y, 6, 5, '#2d6b27')
  px(ctx, x, y + 1, 8, 3, '#2d6b27')
  // Highlights
  px(ctx, x + 2, y, 2, 1, '#3d8b37')
  px(ctx, x + 5, y + 1, 2, 1, '#3d8b37')
}

// ─── Bedroom ─────────────────────────────────────────────────

function drawBedroom(ctx: CanvasRenderingContext2D, r: RoomDef, tod: TimeOfDay = 'afternoon', hour: number = 14) {
  // Dark parquet floor
  tiledFloor(ctx, r.x, r.y, r.w, r.h, '#3a3550', '#2e2a42', 4)

  // Top wall depth (gradient strip)
  px(ctx, r.x, r.y, r.w, 3, '#4a4562')
  px(ctx, r.x, r.y + 3, r.w, 1, '#3a3550')

  // Carpet in center
  const carpetX = r.x + r.w / 2 - 25
  const carpetY = r.y + r.h / 2 - 12
  px(ctx, carpetX, carpetY, 50, 24, '#5a3a5a')
  px(ctx, carpetX + 2, carpetY + 2, 46, 20, '#6a4a6a')
  px(ctx, carpetX + 4, carpetY + 4, 42, 16, '#7a5a7a')
  // Carpet pattern
  px(ctx, carpetX + 22, carpetY + 6, 6, 12, '#8a6a8a')

  // 4 Beds (2 on each side)
  drawBed(ctx, r.x + 6, r.y + 14, '#6688bb', '#aaccee') // blue
  drawBed(ctx, r.x + 6, r.y + r.h - 30, '#bb6688', '#eeccdd') // pink
  drawBed(ctx, r.x + r.w - 42, r.y + 14, '#66bb88', '#aaeebb') // green
  drawBed(ctx, r.x + r.w - 42, r.y + r.h - 30, '#8866bb', '#ccaaee') // purple

  // Nightstands (between beds)
  drawNightstand(ctx, r.x + 42, r.y + 18)
  drawNightstand(ctx, r.x + 42, r.y + r.h - 26)
  drawNightstand(ctx, r.x + r.w - 48, r.y + 18)
  drawNightstand(ctx, r.x + r.w - 48, r.y + r.h - 26)

  // Wall lamps
  px(ctx, r.x + r.w / 2 - 10, r.y + 3, 3, 3, '#222233')
  px(ctx, r.x + r.w / 2 - 9, r.y + 4, 1, 1, '#ffee66')
  px(ctx, r.x + r.w / 2 + 8, r.y + 3, 3, 3, '#222233')
  px(ctx, r.x + r.w / 2 + 9, r.y + 4, 1, 1, '#ffee66')
}

function drawBed(ctx: CanvasRenderingContext2D, x: number, y: number, blanketColor: string, pillowColor: string) {
  // Frame
  px(ctx, x, y, 35, 16, '#2a2440')
  // Mattress
  px(ctx, x + 1, y + 1, 33, 14, '#4a4464')
  // Blanket (covers most)
  px(ctx, x + 2, y + 4, 31, 10, blanketColor)
  px(ctx, x + 3, y + 5, 29, 8, lightenHex(blanketColor, 15))
  // Pillow
  px(ctx, x + 2, y + 2, 8, 4, pillowColor)
  px(ctx, x + 3, y + 2, 6, 1, lightenHex(pillowColor, 20))
  // Headboard
  px(ctx, x, y, 2, 16, '#1a1830')
}

function drawNightstand(ctx: CanvasRenderingContext2D, x: number, y: number) {
  px(ctx, x, y, 6, 6, '#3a3050')
  px(ctx, x + 1, y, 4, 1, '#4a4060') // top highlight
  px(ctx, x + 2, y + 2, 2, 1, '#ffee66') // lamp on top
}

// ─── Living Room ─────────────────────────────────────────────

function drawLivingRoom(ctx: CanvasRenderingContext2D, r: RoomDef, tod: TimeOfDay = 'afternoon', hour: number = 14) {
  // Warm parquet floor
  tiledFloor(ctx, r.x, r.y, r.w, r.h, '#5c4a32', '#4d3e2a', 4)

  // Top wall depth
  px(ctx, r.x, r.y, r.w, 3, '#6b5a42')
  px(ctx, r.x, r.y + 3, r.w, 1, '#5c4a32')

  // Large carpet
  const carpetX = r.x + r.w / 2 - 35
  const carpetY = r.y + r.h / 2 - 15
  px(ctx, carpetX, carpetY, 70, 30, '#6b4040')
  px(ctx, carpetX + 2, carpetY + 2, 66, 26, '#7b5050')
  // Carpet pattern
  px(ctx, carpetX + 10, carpetY + 8, 50, 14, '#8b6060')
  px(ctx, carpetX + 30, carpetY + 4, 10, 22, '#7b5050')

  // Sofa 1 (left, L-shaped)
  drawSofa(ctx, r.x + 8, r.y + 20, false)
  // Sofa 2 (bottom)
  drawSofa(ctx, r.x + r.w / 2 - 18, r.y + r.h - 30, true)

  // TV on top wall
  const tvX = r.x + r.w / 2 - 12
  px(ctx, tvX, r.y + 4, 24, 14, '#1a1a22') // frame
  px(ctx, tvX + 1, r.y + 5, 22, 12, '#3344aa') // screen glow
  px(ctx, tvX + 2, r.y + 6, 20, 10, '#4455bb') // screen
  // TV stand
  px(ctx, tvX + 10, r.y + 18, 4, 3, '#2a2a3a')
  px(ctx, tvX + 6, r.y + 21, 12, 2, '#2a2a3a')

  // Coffee table
  const ctX = r.x + r.w / 2 - 10
  const ctY = r.y + r.h / 2 - 4
  px(ctx, ctX, ctY, 20, 10, '#5c3a20')
  px(ctx, ctX + 1, ctY, 18, 1, '#6b4a30') // highlight
  // Items on table
  px(ctx, ctX + 3, ctY + 2, 4, 3, '#aaaaaa') // remote
  px(ctx, ctX + 12, ctY + 3, 4, 4, '#66aaff') // cup

  // Bookshelf on right wall
  const bsX = r.x + r.w - 14
  const bsY = r.y + 8
  px(ctx, bsX, bsY, 10, 30, '#3a2e20') // shelf frame
  // Shelves
  for (let s = 0; s < 3; s++) {
    px(ctx, bsX, bsY + 4 + s * 10, 10, 1, '#4a3e30')
    // Books (colored vertical lines)
    const colors = ['#cc4444', '#44aa44', '#4444cc', '#ccaa44', '#aa44aa']
    for (let b = 0; b < 4; b++) {
      px(ctx, bsX + 1 + b * 2, bsY + s * 10 + 1, 2, 3, colors[(s * 4 + b) % colors.length])
    }
  }

  // Plant in corner
  px(ctx, r.x + 4, r.y + r.h - 14, 6, 4, '#5c3a20') // pot
  px(ctx, r.x + 2, r.y + r.h - 22, 10, 8, '#2d7b27') // leaves
  px(ctx, r.x + 4, r.y + r.h - 24, 6, 4, '#3d9b37')  // top leaves
  px(ctx, r.x + 6, r.y + r.h - 26, 2, 3, '#4dab47')  // tip
}

function drawSofa(ctx: CanvasRenderingContext2D, x: number, y: number, horizontal: boolean) {
  if (horizontal) {
    // Horizontal sofa
    px(ctx, x, y, 36, 14, '#5a3a3a') // base
    px(ctx, x + 1, y + 1, 34, 12, '#7a5a5a') // cushion
    // Armrests
    px(ctx, x, y, 4, 14, '#5a3a3a')
    px(ctx, x + 32, y, 4, 14, '#5a3a3a')
    // Cushion lines
    px(ctx, x + 12, y + 2, 1, 10, '#6a4a4a')
    px(ctx, x + 23, y + 2, 1, 10, '#6a4a4a')
    // Highlights
    px(ctx, x + 5, y + 2, 6, 2, '#8a6a6a')
    px(ctx, x + 14, y + 2, 8, 2, '#8a6a6a')
    px(ctx, x + 25, y + 2, 6, 2, '#8a6a6a')
  } else {
    // Vertical sofa (L-shape)
    px(ctx, x, y, 14, 36, '#5a3a3a') // base
    px(ctx, x + 1, y + 1, 12, 34, '#7a5a5a') // cushion
    // Armrests
    px(ctx, x, y, 14, 4, '#5a3a3a')
    px(ctx, x, y + 32, 14, 4, '#5a3a3a')
    // Cushion lines
    px(ctx, x + 2, y + 12, 10, 1, '#6a4a4a')
    px(ctx, x + 2, y + 23, 10, 1, '#6a4a4a')
    // Highlights
    px(ctx, x + 2, y + 5, 2, 6, '#8a6a6a')
    // L extension
    px(ctx, x + 14, y + 24, 16, 12, '#5a3a3a')
    px(ctx, x + 15, y + 25, 14, 10, '#7a5a5a')
  }
}

// ─── Kitchen ─────────────────────────────────────────────────

function drawKitchen(ctx: CanvasRenderingContext2D, r: RoomDef) {
  // Tile floor
  tiledFloor(ctx, r.x, r.y, r.w, r.h, '#c4a35a', '#b89950', 4)

  // Top wall depth
  px(ctx, r.x, r.y, r.w, 3, '#d4b36a')
  px(ctx, r.x, r.y + 3, r.w, 1, '#c4a35a')

  // Counter + cabinets along top wall (gap in middle for door)
  const counterY = r.y + 6
  const doorGapLeft = r.x + r.w / 2 - 8  // gap from ~center-8 to center+8
  const doorGapRight = r.x + r.w / 2 + 8
  // Left counter
  px(ctx, r.x + 4, counterY, doorGapLeft - (r.x + 4), 16, '#5c4a32')
  px(ctx, r.x + 4, counterY, doorGapLeft - (r.x + 4), 2, '#6b5a42')
  // Right counter
  px(ctx, doorGapRight, counterY, r.x + r.w - 4 - doorGapRight, 16, '#5c4a32')
  px(ctx, doorGapRight, counterY, r.x + r.w - 4 - doorGapRight, 2, '#6b5a42')
  // Cabinet doors (left side)
  for (let c = 0; c < 2; c++) {
    const cx = r.x + 8 + c * 18
    if (cx + 14 > doorGapLeft) break
    px(ctx, cx, counterY + 3, 14, 11, '#4a3a22')
    px(ctx, cx + 1, counterY + 4, 12, 9, '#5a4a32')
    px(ctx, cx + 6, counterY + 7, 2, 2, '#8b7355')
  }
  // Cabinet doors (right side)
  for (let c = 0; c < 2; c++) {
    const cx = doorGapRight + 4 + c * 18
    if (cx + 14 > r.x + r.w - 4) break
    px(ctx, cx, counterY + 3, 14, 11, '#4a3a22')
    px(ctx, cx + 1, counterY + 4, 12, 9, '#5a4a32')
    px(ctx, cx + 6, counterY + 7, 2, 2, '#8b7355')
  }

  // Fridge (left side of counter)
  px(ctx, r.x + 4, counterY - 4, 14, 20, '#ccccdd')
  px(ctx, r.x + 5, counterY - 3, 12, 8, '#bbbbcc') // top door
  px(ctx, r.x + 5, counterY + 6, 12, 9, '#bbbbcc')  // bottom door
  px(ctx, r.x + 15, counterY, 2, 3, '#999999') // handle top
  px(ctx, r.x + 15, counterY + 8, 2, 3, '#999999') // handle bottom

  // Stove (right side of counter)
  const stoveX = r.x + r.w - 22
  px(ctx, stoveX, counterY, 16, 14, '#333344')
  px(ctx, stoveX + 1, counterY + 1, 14, 2, '#444455')
  // Burners
  px(ctx, stoveX + 2, counterY + 1, 3, 2, '#cc3333')
  px(ctx, stoveX + 7, counterY + 1, 3, 2, '#cc3333')
  px(ctx, stoveX + 12, counterY + 1, 2, 2, '#993333') // off burner

  // Sink (middle of counter)
  const sinkX = r.x + r.w / 2 - 6
  px(ctx, sinkX, counterY + 2, 12, 8, '#777788')
  px(ctx, sinkX + 1, counterY + 3, 10, 6, '#8888aa')
  px(ctx, sinkX + 4, counterY + 3, 4, 2, '#88bbcc') // water
  px(ctx, sinkX + 5, counterY, 2, 3, '#999999') // faucet

  // Dining table in center
  const tableX = r.x + r.w / 2 - 20
  const tableY = r.y + r.h / 2 + 5
  px(ctx, tableX, tableY, 40, 20, '#6b5a42')
  px(ctx, tableX + 1, tableY, 38, 1, '#7b6a52') // highlight

  // Plates on table
  px(ctx, tableX + 5, tableY + 4, 4, 4, '#ffffff')
  px(ctx, tableX + 6, tableY + 5, 2, 2, '#eeeeee')
  px(ctx, tableX + 18, tableY + 4, 4, 4, '#ffffff')
  px(ctx, tableX + 31, tableY + 4, 4, 4, '#ffffff')
  px(ctx, tableX + 18, tableY + 13, 4, 4, '#ffffff')

  // Chairs (small squares around table)
  drawChair(ctx, tableX + 4, tableY - 6)      // top-left
  drawChair(ctx, tableX + 18, tableY - 6)     // top-center
  drawChair(ctx, tableX + 32, tableY - 6)     // top-right
  drawChair(ctx, tableX + 4, tableY + 22)     // bottom-left
  drawChair(ctx, tableX + 18, tableY + 22)    // bottom-center
  drawChair(ctx, tableX + 32, tableY + 22)    // bottom-right
}

function drawChair(ctx: CanvasRenderingContext2D, x: number, y: number) {
  px(ctx, x, y, 6, 6, '#4a3a2a')
  px(ctx, x + 1, y + 1, 4, 4, '#5a4a3a')
}

// ─── Bathroom ────────────────────────────────────────────

function drawBathroom(ctx: CanvasRenderingContext2D, r: RoomDef) {
  // Light tile floor
  tiledFloor(ctx, r.x, r.y, r.w, r.h, '#2a4a5a', '#254458', 4)

  // Top wall depth
  px(ctx, r.x, r.y, r.w, 3, '#3a5a6a')
  px(ctx, r.x, r.y + 3, r.w, 1, '#2a4a5a')

  // Bathtub (top-left)
  px(ctx, r.x + 6, r.y + 8, 36, 18, '#ddeeff')
  px(ctx, r.x + 7, r.y + 9, 34, 16, '#bbddee')
  px(ctx, r.x + 8, r.y + 10, 32, 14, '#99ccdd') // water
  // Faucet
  px(ctx, r.x + 8, r.y + 8, 4, 2, '#999999')
  px(ctx, r.x + 9, r.y + 6, 2, 3, '#aaaaaa')

  // Toilet (bottom-right)
  const toiletX = r.x + r.w - 30
  const toiletY = r.y + r.h - 22
  px(ctx, toiletX, toiletY, 14, 16, '#eeeeff')
  px(ctx, toiletX + 1, toiletY + 1, 12, 14, '#ddddef')
  px(ctx, toiletX + 3, toiletY - 2, 8, 4, '#eeeeff') // tank
  px(ctx, toiletX + 5, toiletY + 3, 4, 6, '#ccccdd') // bowl

  // Sink + mirror (top-right)
  const sinkX = r.x + r.w - 30
  const sinkY = r.y + 8
  px(ctx, sinkX, sinkY, 16, 10, '#ddddee') // sink basin
  px(ctx, sinkX + 1, sinkY + 1, 14, 8, '#ccccdd')
  px(ctx, sinkX + 6, sinkY + 3, 4, 3, '#88bbcc') // water
  px(ctx, sinkX + 7, sinkY, 2, 2, '#999999') // faucet
  // Mirror
  px(ctx, sinkX + 2, sinkY - 6, 12, 6, '#445566')
  px(ctx, sinkX + 3, sinkY - 5, 10, 4, '#667788')

  // Bath mat
  px(ctx, r.x + r.w / 2 - 8, r.y + r.h / 2, 16, 8, '#5577aa')
  px(ctx, r.x + r.w / 2 - 7, r.y + r.h / 2 + 1, 14, 6, '#6688bb')

  // Towel rack on left wall
  px(ctx, r.x + 2, r.y + r.h / 2 - 4, 3, 12, '#888888')
  px(ctx, r.x + 1, r.y + r.h / 2 - 2, 4, 3, '#bb8844') // towel
  px(ctx, r.x + 1, r.y + r.h / 2 + 2, 4, 3, '#44aa88') // towel
}

// ─── Confessional ────────────────────────────────────────────

function drawConfessional(ctx: CanvasRenderingContext2D, r: RoomDef) {
  // Dark red floor
  tiledFloor(ctx, r.x, r.y, r.w, r.h, '#3a1a1a', '#2e1515', 4)

  // Top wall depth
  px(ctx, r.x, r.y, r.w, 3, '#4a2a2a')
  px(ctx, r.x, r.y + 3, r.w, 1, '#3a1a1a')

  // Spotlight effect (lighter circle on floor)
  const spotX = r.x + r.w / 2
  const spotY = r.y + r.h / 2 + 5
  ctx.fillStyle = 'rgba(255,255,200,0.08)'
  ctx.beginPath()
  ctx.ellipse(spotX, spotY, 20, 12, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.fillStyle = 'rgba(255,255,200,0.06)'
  ctx.beginPath()
  ctx.ellipse(spotX, spotY, 14, 8, 0, 0, Math.PI * 2)
  ctx.fill()

  // Armchair (center)
  const chairX = r.x + r.w / 2 - 10
  const chairY = r.y + r.h / 2 - 2
  // Back
  px(ctx, chairX, chairY - 4, 20, 4, '#4a2030')
  px(ctx, chairX + 1, chairY - 3, 18, 2, '#6a3050')
  // Seat
  px(ctx, chairX, chairY, 20, 12, '#5a2040')
  px(ctx, chairX + 1, chairY + 1, 18, 10, '#7a4060')
  // Armrests
  px(ctx, chairX - 2, chairY, 3, 12, '#4a2030')
  px(ctx, chairX + 19, chairY, 3, 12, '#4a2030')

  // Camera on tripod (right side)
  const camX = r.x + r.w - 30
  const camY = r.y + 12
  // Tripod legs
  px(ctx, camX + 2, camY + 8, 1, 14, '#555555')
  px(ctx, camX + 6, camY + 8, 1, 14, '#555555')
  px(ctx, camX, camY + 20, 1, 4, '#555555')
  px(ctx, camX + 8, camY + 20, 1, 4, '#555555')
  // Camera body
  px(ctx, camX, camY, 8, 6, '#222233')
  px(ctx, camX + 1, camY + 1, 6, 4, '#333344')
  // Lens
  px(ctx, camX - 2, camY + 1, 3, 4, '#111122')
  // Recording indicator (red)
  px(ctx, camX + 7, camY, 2, 2, '#ff0000')

  // Curtains on sides
  for (let cy = r.y + 4; cy < r.y + r.h - 4; cy += 4) {
    px(ctx, r.x + 2, cy, 6, 3, '#4a1020')
    px(ctx, r.x + 3, cy, 4, 1, '#5a2030')
    px(ctx, r.x + r.w - 8, cy, 6, 3, '#4a1020')
    px(ctx, r.x + r.w - 7, cy, 4, 1, '#5a2030')
  }
}

// ─── Walls ───────────────────────────────────────────────────

function drawWalls(ctx: CanvasRenderingContext2D, locs: Locations) {
  const wallDark = '#2a2a3e'
  const wallLight = '#3a3a52'
  const doorColor = '#4a4a5e'
  const wallW = 3

  // Horizontal wall between yard and indoor rooms
  const wallY = locs.bedroom.y
  px(ctx, 0, wallY - wallW, locs.bedroom.x + locs.bedroom.w + locs.living_room.w + locs.kitchen.w, wallW, wallDark)
  px(ctx, 0, wallY - wallW, locs.bedroom.x + locs.bedroom.w + locs.living_room.w + locs.kitchen.w, 1, wallLight)
  // Door openings (gaps in wall)
  px(ctx, locs.bedroom.x + locs.bedroom.w / 2 - 5, wallY - wallW, 10, wallW, doorColor)
  px(ctx, locs.living_room.x + locs.living_room.w / 2 - 5, wallY - wallW, 10, wallW, doorColor)
  px(ctx, locs.kitchen.x + locs.kitchen.w / 2 - 5, wallY - wallW, 10, wallW, doorColor)

  // Vertical walls between rooms
  // Between bedroom and living room
  const vert1X = locs.living_room.x
  px(ctx, vert1X - wallW, locs.bedroom.y, wallW, locs.bedroom.h, wallDark)
  px(ctx, vert1X - 1, locs.bedroom.y, 1, locs.bedroom.h, wallLight)
  // Door
  px(ctx, vert1X - wallW, locs.bedroom.y + locs.bedroom.h / 2 - 5, wallW, 10, doorColor)

  // Between living room and kitchen
  const vert2X = locs.kitchen.x
  px(ctx, vert2X - wallW, locs.kitchen.y, wallW, locs.kitchen.h, wallDark)
  px(ctx, vert2X - 1, locs.kitchen.y, 1, locs.kitchen.h, wallLight)
  // Door
  px(ctx, vert2X - wallW, locs.kitchen.y + locs.kitchen.h / 2 - 5, wallW, 10, doorColor)

  // Wall between indoor rooms and bathroom/confessional (bottom row)
  const bottomRowTop = locs.confessional.y  // same as bathroom.y
  // Bathroom wall (under bedroom) with door gap
  px(ctx, 0, bottomRowTop - wallW, locs.bathroom.x + locs.bathroom.w, wallW, wallDark)
  px(ctx, 0, bottomRowTop - wallW, locs.bathroom.x + locs.bathroom.w, 1, wallLight)
  // Door from bedroom to bathroom
  px(ctx, locs.bathroom.x + locs.bathroom.w / 2 - 5, bottomRowTop - wallW, 10, wallW, doorColor)
  // Right part (under kitchen)
  const confRight = locs.confessional.x + locs.confessional.w
  px(ctx, confRight, bottomRowTop - wallW, 480 - confRight, wallW, wallDark)
  px(ctx, confRight, bottomRowTop - wallW, 480 - confRight, 1, wallLight)
  // Door to confessional from living room
  px(ctx, locs.confessional.x + locs.confessional.w / 2 - 5, bottomRowTop - wallW, 10, wallW, doorColor)

  // Wall between bathroom and confessional
  const bathRight = locs.bathroom.x + locs.bathroom.w
  px(ctx, bathRight, locs.bathroom.y, wallW, locs.bathroom.h, wallDark)

  // Outer walls
  px(ctx, confRight, locs.confessional.y, wallW, locs.confessional.h, wallDark)
}

// ─── Day/Night Lighting ──────────────────────────────────────

function applyLighting(
  ctx: CanvasRenderingContext2D,
  locs: Locations,
  tod: TimeOfDay,
  hour: number,
) {
  let overlay: string | null = null
  switch (tod) {
    case 'morning':
      overlay = 'rgba(255,220,150,0.08)'
      break
    case 'afternoon':
      overlay = null
      break
    case 'evening':
      overlay = 'rgba(255,140,50,0.15)'
      break
    case 'night':
      overlay = 'rgba(20,20,60,0.35)'
      break
  }

  // Smooth transitions at boundaries
  if (hour >= 5 && hour < 7) {
    const t = (hour - 5) / 2
    overlay = `rgba(20,20,60,${(0.35 * (1 - t)).toFixed(2)})`
  } else if (hour >= 17 && hour < 19) {
    const t = (hour - 17) / 2
    overlay = `rgba(255,140,50,${(0.15 * t).toFixed(2)})`
  } else if (hour >= 21 && hour < 23) {
    const t = (hour - 21) / 2
    const r = Math.round(140 * (1 - t) + 20 * t)
    const g = Math.round(77 * (1 - t) + 20 * t)
    const b = Math.round(50 * (1 - t) + 60 * t)
    const alpha = 0.15 + (0.35 - 0.15) * t
    overlay = `rgba(${r},${g},${b},${alpha.toFixed(2)})`
  }

  if (overlay) {
    ctx.fillStyle = overlay
    for (const loc of Object.values(locs)) {
      ctx.fillRect(loc.x, loc.y, loc.w, loc.h)
    }
  }

  // Indoor room windows
  const windowRooms = [locs.bedroom, locs.living_room, locs.bathroom]
  for (const room of windowRooms) {
    const winY = room.y + 4
    const winW = 8
    const winH = 6
    const win1X = room.x + room.w * 0.3 - winW / 2
    const win2X = room.x + room.w * 0.7 - winW / 2

    for (const wx of [win1X, win2X]) {
      px(ctx, wx - 1, winY - 1, winW + 2, winH + 2, '#333344')
      if (tod === 'night' || hour >= 22 || hour < 6) {
        px(ctx, wx, winY, winW, winH, '#1a1a3a')
        ctx.fillStyle = 'rgba(255,238,100,0.12)'
        ctx.beginPath()
        ctx.ellipse(wx + winW / 2, winY + winH + 4, 10, 6, 0, 0, Math.PI * 2)
        ctx.fill()
      } else if (tod === 'evening') {
        px(ctx, wx, winY, winW, winH, '#cc7744')
      } else {
        px(ctx, wx, winY, winW, winH, '#88bbdd')
      }
    }
  }
}

// ─── Utilities ───────────────────────────────────────────────

function lightenHex(hex: string, amount: number): string {
  const r = Math.min(255, parseInt(hex.slice(1, 3), 16) + amount)
  const g = Math.min(255, parseInt(hex.slice(3, 5), 16) + amount)
  const b = Math.min(255, parseInt(hex.slice(5, 7), 16) + amount)
  return '#' + [r, g, b].map(v => v.toString(16).padStart(2, '0')).join('')
}
