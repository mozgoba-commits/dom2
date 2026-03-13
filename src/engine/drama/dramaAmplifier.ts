import { Agent, DramaScore, LocationId } from '../types'
import { RelationshipGraph } from '../relationships/graph'
import { applyEmotionalImpact } from '../agents/personality'

/**
 * The "invisible hand" — when drama is too low, subtly push agents toward conflict.
 */
export function amplifyDrama(
  agents: Agent[],
  drama: DramaScore,
  relationships: RelationshipGraph
): Agent[] {
  // Only amplify when drama is stagnating
  if (drama.overall > 40 || drama.ticksSinceLastDrama < 10) {
    return agents
  }

  const active = agents.filter(a => !a.isEvicted && a.status !== 'sleeping')
  if (active.length < 2) return agents

  return agents.map(agent => {
    if (agent.isEvicted || agent.status === 'sleeping') return agent

    // Boost needs to force interaction
    const needBoost = drama.ticksSinceLastDrama > 20 ? 15 : 5
    const boostedNeeds = {
      ...agent.needs,
      socialNeed: Math.max(0, agent.needs.socialNeed - needBoost),
      validationNeed: Math.max(0, agent.needs.validationNeed - needBoost),
    }

    // Boost drama-prone emotions for drama-prone characters
    let boostedEmotions = agent.emotions
    if (agent.traits.dramaTendency > 60) {
      boostedEmotions = applyEmotionalImpact(agent.emotions, {
        anger: 2,
        excitement: 3,
      })
    }

    // Boost jealousy for characters with romantic interests
    const romanticRels = relationships.getRomanticInterests(agent.id, 20)
    if (romanticRels.length > 0 && agent.traits.jealousy > 40) {
      boostedEmotions = applyEmotionalImpact(boostedEmotions, {
        jealousy: 8,
      })
    }

    return {
      ...agent,
      needs: boostedNeeds,
      emotions: boostedEmotions,
    }
  })
}

/**
 * Decide if it's a good time to trigger a special event.
 */
export function shouldTriggerEvent(drama: DramaScore): {
  shouldTrigger: boolean
  type: 'tok_show' | 'new_arrival' | 'confessional' | null
} {
  if (drama.ticksSinceLastDrama > 30 && drama.overall < 30) {
    return { shouldTrigger: true, type: 'tok_show' }
  }
  if (drama.ticksSinceLastDrama > 50 && drama.overall < 20) {
    return { shouldTrigger: true, type: 'new_arrival' }
  }
  if (drama.overall > 60) {
    // High drama — send someone to confessional for juicy commentary
    return { shouldTrigger: true, type: 'confessional' }
  }
  return { shouldTrigger: false, type: null }
}

/**
 * Force two agents into proximity to trigger interaction.
 */
export function forceEncounter(
  agents: Agent[],
  relationships: RelationshipGraph
): { agentA: Agent; agentB: Agent; location: LocationId } | null {
  const active = agents.filter(a => !a.isEvicted && a.status === 'free')
  if (active.length < 2) return null

  // Find the pair with highest rivalry (most drama potential)
  let bestPair: { a: Agent; b: Agent; score: number } | null = null

  for (let i = 0; i < active.length; i++) {
    for (let j = i + 1; j < active.length; j++) {
      const rel = relationships.get(active[i].id, active[j].id)
      if (!rel) continue
      const dramaScore = rel.rivalry + Math.abs(rel.friendship) + rel.romance * 0.5
      if (!bestPair || dramaScore > bestPair.score) {
        bestPair = { a: active[i], b: active[j], score: dramaScore }
      }
    }
  }

  if (!bestPair) return null

  // Pick a shared location
  const location: LocationId = bestPair.a.location === bestPair.b.location
    ? bestPair.a.location
    : 'kitchen' // kitchen is a natural gathering spot

  return { agentA: bestPair.a, agentB: bestPair.b, location }
}
