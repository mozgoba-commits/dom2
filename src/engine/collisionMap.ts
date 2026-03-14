// Collision map for character movement in native 480×360 canvas coordinates
// Characters use (cx, cy) where cy = feet bottom. Character half-width ~6px.

import type { LocationId } from './types'

interface Rect { x: number; y: number; w: number; h: number }

// Padding added to furniture for character clearance
const PAD = 7

// ─── Room floor bounds (walkable interior, excluding walls) ──────

const ROOM_FLOORS: Record<LocationId, Rect> = {
  yard:         { x: 8,   y: 14,  w: 464, h: 112 },
  bedroom:      { x: 3,   y: 136, w: 151, h: 140 },
  living_room:  { x: 163, y: 136, w: 151, h: 140 },
  kitchen:      { x: 323, y: 136, w: 154, h: 140 },
  bathroom:     { x: 3,   y: 286, w: 151, h: 71  },
  confessional: { x: 163, y: 286, w: 151, h: 71  },
}

// ─── Furniture obstacles per room (padded for character clearance) ──

const OBSTACLES: Record<LocationId, Rect[]> = {
  yard: [
    // Fence top
    { x: 0, y: 0, w: 480, h: 14 },
    // Campfire area
    { x: 240 - PAD, y: 58 - PAD, w: 14 + PAD * 2, h: 14 + PAD * 2 },
    // Benches
    { x: 96 - PAD, y: 49 - PAD, w: 16 + PAD * 2, h: 8 + PAD * 2 },
    { x: 360 - PAD, y: 49 - PAD, w: 16 + PAD * 2, h: 8 + PAD * 2 },
  ],
  bedroom: [
    // Bed 1 top-left
    { x: 0, y: 141, w: 41 + PAD, h: 22 + PAD },
    // Bed 2 bottom-left
    { x: 0, y: 244, w: 41 + PAD, h: 22 + PAD },
    // Bed 3 top-right
    { x: 115 - PAD, y: 141, w: 42 + PAD, h: 22 + PAD },
    // Bed 4 bottom-right
    { x: 115 - PAD, y: 244, w: 42 + PAD, h: 22 + PAD },
    // Nightstands (between beds)
    { x: 42 - 2, y: 149, w: 10, h: 10 },
    { x: 42 - 2, y: 252, w: 10, h: 10 },
    { x: 107, y: 149, w: 10, h: 10 },
    { x: 107, y: 252, w: 10, h: 10 },
  ],
  living_room: [
    // Sofa left (vertical)
    { x: 160, y: 147, w: 22 + PAD, h: 42 },
    // TV + stand (top wall)
    { x: 196 - PAD, y: 133, w: 24 + PAD * 2, h: 25 },
    // Coffee table
    { x: 190 - PAD, y: 163 - PAD, w: 20 + PAD * 2, h: 10 + PAD * 2 },
    // Bookshelf (right wall)
    { x: 300, y: 133, w: 17, h: 38 + PAD },
    // Sofa bottom
    { x: 160, y: 258, w: 36 + PAD, h: 22 },
    // Plant
    { x: 160, y: 245, w: 12, h: 15 },
  ],
  kitchen: [
    // Counter left (fridge side) — gap at x~395-410 for door from yard
    { x: 320, y: 133, w: 72, h: 24 + PAD },
    // Counter right (stove side)
    { x: 412, y: 133, w: 68, h: 24 + PAD },
    // Dining table
    { x: 340 - PAD, y: 195 - PAD, w: 40 + PAD * 2, h: 20 + PAD * 2 },
  ],
  bathroom: [
    // Bathtub (top-left)
    { x: 3, y: 286, w: 40 + PAD, h: 22 + PAD },
    // Toilet (bottom-right)
    { x: 120 - PAD, y: 335, w: 22 + PAD * 2, h: 18 + PAD },
    // Sink (top-right)
    { x: 120 - PAD, y: 286, w: 22 + PAD * 2, h: 14 + PAD },
  ],
  confessional: [
    // Armchair
    { x: 228 - PAD, y: 312, w: 20 + PAD * 2, h: 18 + PAD },
    // Camera + tripod
    { x: 300, y: 289, w: 18, h: 36 },
  ],
}

// ─── Collision API ──────────────────────────────────────────────

/** Check if a point (character feet) is inside any obstacle */
export function isInObstacle(x: number, y: number, room?: LocationId): boolean {
  const rooms = room ? [room] : (['yard', 'bedroom', 'living_room', 'kitchen', 'bathroom', 'confessional'] as LocationId[])
  for (const r of rooms) {
    for (const obs of OBSTACLES[r]) {
      if (x >= obs.x && x <= obs.x + obs.w && y >= obs.y && y <= obs.y + obs.h) {
        return true
      }
    }
  }
  return false
}

/** Find which room a point belongs to */
export function getRoomAt(x: number, y: number): LocationId | null {
  for (const [id, floor] of Object.entries(ROOM_FLOORS)) {
    if (x >= floor.x && x <= floor.x + floor.w && y >= floor.y && y <= floor.y + floor.h) {
      return id as LocationId
    }
  }
  return null
}

/** Clamp a position to be within room floor and outside all obstacles */
export function clampToWalkable(room: LocationId, x: number, y: number): { x: number; y: number } {
  const floor = ROOM_FLOORS[room]
  if (!floor) return { x, y }

  // Clamp to floor bounds
  let cx = Math.max(floor.x + 6, Math.min(floor.x + floor.w - 6, x))
  let cy = Math.max(floor.y + 6, Math.min(floor.y + floor.h - 4, y))

  // Push out of obstacles
  const obstacles = OBSTACLES[room]
  for (const obs of obstacles) {
    if (cx >= obs.x && cx <= obs.x + obs.w && cy >= obs.y && cy <= obs.y + obs.h) {
      // Find nearest edge to push to
      const pushLeft = cx - obs.x
      const pushRight = (obs.x + obs.w) - cx
      const pushUp = cy - obs.y
      const pushDown = (obs.y + obs.h) - cy
      const minPush = Math.min(pushLeft, pushRight, pushUp, pushDown)

      if (minPush === pushLeft) cx = obs.x - 1
      else if (minPush === pushRight) cx = obs.x + obs.w + 1
      else if (minPush === pushUp) cy = obs.y - 1
      else cy = obs.y + obs.h + 1
    }
  }

  // Re-clamp after push
  cx = Math.max(floor.x + 6, Math.min(floor.x + floor.w - 6, cx))
  cy = Math.max(floor.y + 6, Math.min(floor.y + floor.h - 4, cy))

  return { x: Math.round(cx), y: Math.round(cy) }
}

/** Generate a random walkable position within a room */
export function randomWalkablePosition(room: LocationId): { x: number; y: number } {
  const floor = ROOM_FLOORS[room]
  if (!floor) return { x: 240, y: 180 }

  // Try up to 20 random positions
  for (let i = 0; i < 20; i++) {
    const x = floor.x + 8 + Math.random() * (floor.w - 16)
    const y = floor.y + 8 + Math.random() * (floor.h - 12)
    if (!isInObstacle(x, y, room)) {
      return { x: Math.round(x), y: Math.round(y) }
    }
  }

  // Fallback: use room center and clamp
  return clampToWalkable(room, floor.x + floor.w / 2, floor.y + floor.h / 2)
}

/** Resolve collision for a walking step: if next position is blocked, slide along obstacle */
export function resolveWalkingCollision(
  room: LocationId,
  fromX: number, fromY: number,
  toX: number, toY: number,
): { x: number; y: number } {
  // Check if destination is valid
  if (!isInObstacle(toX, toY, room)) {
    // Still clamp to floor
    const floor = ROOM_FLOORS[room]
    if (floor) {
      toX = Math.max(floor.x + 6, Math.min(floor.x + floor.w - 6, toX))
      toY = Math.max(floor.y + 6, Math.min(floor.y + floor.h - 4, toY))
    }
    return { x: toX, y: toY }
  }

  // Try sliding on X axis only
  if (!isInObstacle(toX, fromY, room)) {
    return { x: toX, y: fromY }
  }

  // Try sliding on Y axis only
  if (!isInObstacle(fromX, toY, room)) {
    return { x: fromX, y: toY }
  }

  // Fully blocked — stay put
  return { x: fromX, y: fromY }
}

/** Get walkable floor bounds for a room (for UI/debug) */
export function getRoomFloor(room: LocationId): Rect | null {
  return ROOM_FLOORS[room] ?? null
}
