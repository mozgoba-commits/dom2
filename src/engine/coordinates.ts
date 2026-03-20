// Single source of truth for position remapping between old (server) and new (canvas) coordinate spaces

import type { LocationId } from './types'

// Old layout (server coordinate space)
export const OLD_LOCS: Record<LocationId, { x: number; y: number; w: number; h: number }> = {
  yard:         { x: 0,   y: 0,   w: 320, h: 90  },
  bedroom:      { x: 0,   y: 90,  w: 100, h: 100 },
  living_room:  { x: 100, y: 90,  w: 120, h: 100 },
  kitchen:      { x: 220, y: 90,  w: 100, h: 100 },
  bathroom:     { x: 0,   y: 190, w: 100, h: 50  },
  confessional: { x: 100, y: 190, w: 120, h: 50  },
}

// New canvas layout
export const NEW_LOCS: Record<LocationId, { x: number; y: number; w: number; h: number }> = {
  yard:         { x: 0,   y: 0,   w: 480, h: 130 },
  bedroom:      { x: 0,   y: 133, w: 157, h: 147 },
  living_room:  { x: 160, y: 133, w: 157, h: 147 },
  kitchen:      { x: 320, y: 133, w: 160, h: 147 },
  bathroom:     { x: 0,   y: 283, w: 157, h: 77  },
  confessional: { x: 160, y: 283, w: 157, h: 77  },
}

// Old-coordinate-space room bounds (used by simulation for position generation)
export const OLD_ROOM_BOUNDS: Record<LocationId, { x: number; y: number; w: number; h: number }> = {
  yard:         { x: 10,  y: 10,  w: 300, h: 70  },
  bedroom:      { x: 10,  y: 100, w: 80,  h: 80  },
  living_room:  { x: 110, y: 100, w: 100, h: 80  },
  kitchen:      { x: 230, y: 100, w: 80,  h: 80  },
  bathroom:     { x: 10,  y: 195, w: 80,  h: 40  },
  confessional: { x: 110, y: 195, w: 100, h: 40  },
}

/** Remap a position from old server coordinate space to new canvas layout */
export function remapPosition(
  location: LocationId,
  pos: { x: number; y: number },
): { x: number; y: number } {
  const o = OLD_LOCS[location], n = NEW_LOCS[location]
  if (!o || !n) return pos
  const relX = Math.max(0.12, Math.min(0.88, (pos.x - o.x) / o.w))
  const relY = Math.max(0.18, Math.min(0.82, (pos.y - o.y) / o.h))
  return { x: Math.round(n.x + relX * n.w), y: Math.round(n.y + relY * n.h) }
}
