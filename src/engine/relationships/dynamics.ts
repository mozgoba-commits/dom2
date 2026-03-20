import { Agent, ActionType, RelationshipEvent } from '../types'
import { RelationshipGraph } from './graph'

interface InteractionResult {
  friendshipDelta: number
  romanceDelta: number
  trustDelta: number
  rivalryDelta: number
  event: RelationshipEvent
}

/**
 * Calculate relationship changes from an interaction between two agents.
 */
export function processInteraction(
  actor: Agent,
  target: Agent,
  action: ActionType,
  tick: number,
  context?: string
): InteractionResult {
  switch (action) {
    case 'talk':
      return {
        friendshipDelta: 3 + Math.random() * 4,
        romanceDelta: 0,
        trustDelta: 2,
        rivalryDelta: -1,
        event: { tick, type: 'positive', description: context ?? 'поговорили', impact: 3 },
      }

    case 'flirt':
      return {
        friendshipDelta: 1,
        romanceDelta: 5 + Math.random() * 8,
        trustDelta: 1,
        rivalryDelta: 0,
        event: { tick, type: 'romantic', description: context ?? `${actor.bio.name} флиртует с ${target.bio.name}`, impact: 5 },
      }

    case 'argue':
      return {
        friendshipDelta: -(5 + Math.random() * 10),
        romanceDelta: -2,
        trustDelta: -(3 + Math.random() * 5),
        rivalryDelta: 8 + Math.random() * 10,
        event: { tick, type: 'negative', description: context ?? `${actor.bio.name} и ${target.bio.name} поругались`, impact: -7 },
      }

    case 'gossip':
      return {
        friendshipDelta: 2,
        romanceDelta: 0,
        trustDelta: -1, // gossip erodes trust slightly
        rivalryDelta: 0,
        event: { tick, type: 'positive', description: context ?? 'обменялись сплетнями', impact: 2 },
      }

    case 'comfort':
      return {
        friendshipDelta: 6 + Math.random() * 5,
        romanceDelta: 2,
        trustDelta: 5 + Math.random() * 5,
        rivalryDelta: -3,
        event: { tick, type: 'positive', description: context ?? `${actor.bio.name} утешает ${target.bio.name}`, impact: 6 },
      }

    case 'manipulate':
      return {
        friendshipDelta: 1, // appears friendly
        romanceDelta: 0,
        trustDelta: -2, // erosion if discovered
        rivalryDelta: 0,
        event: { tick, type: 'negative', description: context ?? `${actor.bio.name} манипулирует ${target.bio.name}`, impact: -3 },
      }

    case 'confront':
      return {
        friendshipDelta: -(3 + Math.random() * 7),
        romanceDelta: -3,
        trustDelta: 2, // at least honest
        rivalryDelta: 10 + Math.random() * 10,
        event: { tick, type: 'negative', description: context ?? `${actor.bio.name} конфронтирует ${target.bio.name}`, impact: -5 },
      }

    case 'apologize':
      return {
        friendshipDelta: 5 + Math.random() * 5,
        romanceDelta: 1,
        trustDelta: 4 + Math.random() * 4,
        rivalryDelta: -(5 + Math.random() * 5),
        event: { tick, type: 'positive', description: context ?? `${actor.bio.name} извинился перед ${target.bio.name}`, impact: 5 },
      }

    case 'form_alliance':
      return {
        friendshipDelta: 10,
        romanceDelta: 0,
        trustDelta: 10,
        rivalryDelta: -10,
        event: { tick, type: 'alliance', description: context ?? `${actor.bio.name} и ${target.bio.name} заключили альянс`, impact: 8 },
      }

    case 'break_alliance':
      return {
        friendshipDelta: -15,
        romanceDelta: -5,
        trustDelta: -20,
        rivalryDelta: 15,
        event: { tick, type: 'betrayal', description: context ?? `${actor.bio.name} предал(а) альянс с ${target.bio.name}`, impact: -9 },
      }

    default:
      return {
        friendshipDelta: 0,
        romanceDelta: 0,
        trustDelta: 0,
        rivalryDelta: 0,
        event: { tick, type: 'positive', description: context ?? 'взаимодействие', impact: 0 },
      }
  }
}

/**
 * Apply interaction results to the relationship graph.
 */
export function applyInteraction(
  graph: RelationshipGraph,
  actor: Agent,
  target: Agent,
  action: ActionType,
  tick: number,
  context?: string
): InteractionResult {
  const result = processInteraction(actor, target, action, tick, context)
  graph.update(actor.id, target.id, {
    friendship: result.friendshipDelta,
    romance: result.romanceDelta,
    trust: result.trustDelta,
    rivalry: result.rivalryDelta,
  }, result.event)

  if (action === 'form_alliance') graph.setAlliance(actor.id, target.id, true)
  if (action === 'break_alliance') graph.setAlliance(actor.id, target.id, false)

  return result
}

/**
 * Check if jealousy should trigger from observing a romantic interaction.
 */
export function checkJealousyTrigger(
  observer: Agent,
  actorId: string,
  targetId: string,
  graph: RelationshipGraph
): { triggered: boolean; intensity: number; targetOfJealousy: string } | null {
  const relWithActor = graph.get(observer.id, actorId)
  const relWithTarget = graph.get(observer.id, targetId)

  // Jealous if observer has romantic interest in either party
  if (relWithActor && relWithActor.romance > 30) {
    const intensity = (relWithActor.romance / 100) * (observer.traits.jealousy / 100) * 100
    return { triggered: intensity > 20, intensity, targetOfJealousy: targetId }
  }
  if (relWithTarget && relWithTarget.romance > 30) {
    const intensity = (relWithTarget.romance / 100) * (observer.traits.jealousy / 100) * 100
    return { triggered: intensity > 20, intensity, targetOfJealousy: actorId }
  }

  return null
}
