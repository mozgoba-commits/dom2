import {
  Agent, AgentDecision, ActionType, GameClock, LocationId,
} from '../types'
import { isNightTime } from '../clock'
import { getCriticalNeeds } from '../agents/personality'
import { pickInteractionTarget } from '../agents/attractionMatrix'
import { MemoryStore } from '../memory/memoryStore'
import { RelationshipGraph } from '../relationships/graph'
import { llmGenerateJSON } from '../llm/provider'
import { buildDecisionPrompt } from '../llm/promptBuilder'

interface LLMDecisionResponse {
  action: string
  targetAgent: string | null
  targetLocation: string | null
  reasoning: string
  urgency: number
}

/**
 * Decide what an agent does this tick.
 * Uses rule-based fast path first, falls back to LLM for complex decisions.
 */
export async function makeDecision(
  agent: Agent,
  allAgents: Agent[],
  clock: GameClock,
  memoryStore: MemoryStore,
  relationshipGraph: RelationshipGraph,
  useLLM = true
): Promise<AgentDecision> {
  // --- Fast path: deterministic rules ---

  // Night → sleep
  if (isNightTime(clock) && agent.status !== 'sleeping') {
    return {
      agentId: agent.id,
      action: 'rest',
      targetLocation: 'bedroom',
      reasoning: 'Ночь, пора спать',
      urgency: 8,
    }
  }

  // Low energy → rest
  if (agent.energy < 15) {
    return {
      agentId: agent.id,
      action: 'rest',
      targetLocation: agent.location,
      reasoning: 'Устал(а), нужен отдых',
      urgency: 7,
    }
  }

  // --- Need-based decisions ---
  const criticalNeeds = getCriticalNeeds(agent)
  const others = allAgents.filter(a => a.id !== agent.id && !a.isEvicted)

  if (criticalNeeds.length > 0) {
    const primaryNeed = criticalNeeds[0]
    const target = pickInteractionTarget(agent, others, primaryNeed)

    if (target) {
      const action = needToAction(primaryNeed, agent, target.target)
      return {
        agentId: agent.id,
        action,
        targetAgentId: target.target.id,
        targetLocation: target.target.location,
        reasoning: target.reason,
        urgency: 7,
      }
    }
  }

  // --- Gossip urge ---
  if (agent.gossipUrge > 60) {
    const target = pickInteractionTarget(agent, others, null)
    if (target) {
      return {
        agentId: agent.id,
        action: 'gossip',
        targetAgentId: target.target.id,
        targetLocation: target.target.location,
        reasoning: 'Сгораю от желания посплетничать',
        urgency: 5,
      }
    }
  }

  // --- LLM decision ---
  if (useLLM) {
    try {
      const nearbyAgents = others.filter(a => a.location === agent.location)
      const recentMemories = memoryStore.getRecentMemories(agent.id, 10)
      const relationships = relationshipGraph.getForAgent(agent.id)

      const prompt = buildDecisionPrompt(agent, clock, nearbyAgents, recentMemories, relationships)
      const response = await llmGenerateJSON<LLMDecisionResponse>(prompt, 'cheap')

      const targetAgent = response.targetAgent
        ? allAgents.find(a => a.bio.name === response.targetAgent)
        : undefined

      return {
        agentId: agent.id,
        action: validateAction(response.action),
        targetAgentId: targetAgent?.id,
        targetLocation: validateLocation(response.targetLocation),
        reasoning: response.reasoning,
        urgency: Math.min(10, Math.max(0, response.urgency)),
      }
    } catch (error) {
      console.warn(`LLM decision failed for ${agent.bio.name}:`, error)
    }
  }

  // --- Fallback: random wandering ---
  const locations: LocationId[] = ['yard', 'bedroom', 'living_room', 'kitchen']
  const randomLoc = locations[Math.floor(Math.random() * locations.length)]
  return {
    agentId: agent.id,
    action: 'move',
    targetLocation: randomLoc,
    reasoning: 'Просто гуляю',
    urgency: 2,
  }
}

function needToAction(
  need: 'socialNeed' | 'validationNeed' | 'intimacyNeed' | 'dominanceNeed',
  agent: Agent,
  target: Agent
): ActionType {
  switch (need) {
    case 'socialNeed':
      return 'talk'
    case 'validationNeed':
      return agent.traits.manipulativeness > 60 ? 'manipulate' : 'talk'
    case 'intimacyNeed':
      return agent.traits.flirtatiousness > 50 ? 'flirt' : 'talk'
    case 'dominanceNeed':
      return agent.traits.agreeableness < 30 ? 'confront' : 'talk'
  }
}

function validateAction(action: string): ActionType {
  const valid: ActionType[] = [
    'move', 'talk', 'flirt', 'argue', 'gossip', 'comfort',
    'manipulate', 'avoid', 'rest', 'think', 'cry', 'celebrate',
    'confront', 'apologize', 'form_alliance', 'break_alliance',
  ]
  return valid.includes(action as ActionType) ? (action as ActionType) : 'talk'
}

function validateLocation(loc: string | null): LocationId | undefined {
  if (!loc) return undefined
  const valid: LocationId[] = ['yard', 'bedroom', 'living_room', 'kitchen', 'confessional']
  return valid.includes(loc as LocationId) ? (loc as LocationId) : undefined
}
