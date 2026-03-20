// Simple waypoint pathfinding through door openings between rooms

import type { LocationId } from './types'

export interface Waypoint { x: number; y: number }

// Door positions in native 480x360 coordinates (center of each door gap)
const DOORS: Array<{ from: LocationId; to: LocationId; waypoint: Waypoint }> = [
  { from: 'yard', to: 'bedroom', waypoint: { x: 78, y: 131 } },
  { from: 'yard', to: 'living_room', waypoint: { x: 238, y: 131 } },
  { from: 'yard', to: 'kitchen', waypoint: { x: 400, y: 131 } },
  { from: 'bedroom', to: 'living_room', waypoint: { x: 158, y: 206 } },
  { from: 'living_room', to: 'kitchen', waypoint: { x: 318, y: 206 } },
  { from: 'bedroom', to: 'bathroom', waypoint: { x: 78, y: 281 } },
  { from: 'living_room', to: 'confessional', waypoint: { x: 238, y: 281 } },
]

// Build adjacency graph
const ADJACENCY: Record<LocationId, Array<{ neighbor: LocationId; door: Waypoint }>> = {
  yard: [], bedroom: [], living_room: [], kitchen: [], bathroom: [], confessional: [],
}
for (const d of DOORS) {
  ADJACENCY[d.from].push({ neighbor: d.to, door: d.waypoint })
  ADJACENCY[d.to].push({ neighbor: d.from, door: d.waypoint })
}

/**
 * Find a path of waypoints from current position in fromLocation to targetPos in toLocation.
 * Returns array of waypoints to walk through (does NOT include current position).
 */
export function findPath(
  fromLocation: LocationId,
  fromPos: Waypoint,
  toLocation: LocationId,
  toPos: Waypoint,
): Waypoint[] {
  // Same room — direct path
  if (fromLocation === toLocation) {
    return [toPos]
  }

  // BFS to find shortest room chain
  const visited = new Set<LocationId>()
  const queue: Array<{ loc: LocationId; path: Array<{ from: LocationId; to: LocationId; door: Waypoint }> }> = [
    { loc: fromLocation, path: [] },
  ]
  visited.add(fromLocation)

  while (queue.length > 0) {
    const current = queue.shift()!
    for (const adj of ADJACENCY[current.loc]) {
      if (visited.has(adj.neighbor)) continue
      const newPath = [...current.path, { from: current.loc, to: adj.neighbor, door: adj.door }]
      if (adj.neighbor === toLocation) {
        // Build waypoint list from door chain
        const waypoints: Waypoint[] = []
        for (const step of newPath) {
          waypoints.push(step.door)
        }
        waypoints.push(toPos)
        return waypoints
      }
      visited.add(adj.neighbor)
      queue.push({ loc: adj.neighbor, path: newPath })
    }
  }

  // No path found (should never happen in valid layout) — teleport
  return [toPos]
}
