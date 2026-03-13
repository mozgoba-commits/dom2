/**
 * Calculate importance score for a memory event.
 * Scale: 0-10
 */

export type EventCategory =
  | 'casual_chat'
  | 'argument'
  | 'confession'
  | 'romantic'
  | 'betrayal'
  | 'alliance_formed'
  | 'alliance_broken'
  | 'gossip'
  | 'voting'
  | 'eviction'
  | 'tok_show'
  | 'emotional_breakdown'
  | 'physical_proximity'
  | 'routine'

const BASE_IMPORTANCE: Record<EventCategory, number> = {
  casual_chat: 2,
  argument: 6,
  confession: 7,
  romantic: 7,
  betrayal: 9,
  alliance_formed: 6,
  alliance_broken: 8,
  gossip: 4,
  voting: 8,
  eviction: 10,
  tok_show: 5,
  emotional_breakdown: 7,
  physical_proximity: 1,
  routine: 1,
}

export function calculateImportance(
  category: EventCategory,
  options?: {
    isFirstTime?: boolean      // first interaction of this type with this person
    emotionalIntensity?: number // 0-100
    publicWitnesses?: number   // how many others saw
  }
): number {
  let score = BASE_IMPORTANCE[category]

  if (options?.isFirstTime) score += 1
  if (options?.emotionalIntensity) score += (options.emotionalIntensity / 100) * 2
  if (options?.publicWitnesses && options.publicWitnesses > 2) score += 1

  return Math.min(10, Math.max(0, Math.round(score)))
}
