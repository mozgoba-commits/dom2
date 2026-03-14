// Day planner — Stanford pattern
// Each morning, agents create a plan for the day

import { Agent, AgentPlan } from '../types'
import { MemoryStore } from '../memory/memoryStore'
import { RelationshipGraph } from '../relationships/graph'
import { llmGenerateJSON } from '../llm/provider'
import { buildAgentSystemPrompt, stripThinking } from '../llm/promptBuilder'
import { buildDailySummary } from '../memory/contextBuilder'
import { GameClock } from '../types'

interface LLMPlanResponse {
  goals: string[]
}

export async function generateDayPlan(
  agent: Agent,
  allAgents: Agent[],
  memoryStore: MemoryStore,
  relationshipGraph: RelationshipGraph,
  clock: GameClock,
): Promise<AgentPlan> {
  // Try LLM first, fallback to deterministic
  try {
    const plan = await generateLLMPlan(agent, allAgents, memoryStore, relationshipGraph, clock)
    if (plan.goals.length > 0) {
      console.log(`[Planner] ${agent.bio.name}: ${plan.goals.join('; ')}`)
      return plan
    }
  } catch (error) {
    console.warn(`[Planner] LLM failed for ${agent.bio.name}, using fallback`)
  }

  return generateFallbackPlan(agent, allAgents, relationshipGraph, clock)
}

async function generateLLMPlan(
  agent: Agent,
  allAgents: Agent[],
  memoryStore: MemoryStore,
  relationshipGraph: RelationshipGraph,
  clock: GameClock,
): Promise<AgentPlan> {
  const system = buildAgentSystemPrompt(agent)
  const dailySummary = buildDailySummary(agent.id, memoryStore, clock, allAgents)
  const reflections = memoryStore.getReflections(agent.id, 3)
  const reflectionText = reflections
    .map(r => `- ${r.narrativeSummary ?? r.content}`)
    .join('\n')

  const relationships = relationshipGraph.getForAgent(agent.id)
  const relSummary = relationships
    .map(r => {
      const otherId = r.agentAId === agent.id ? r.agentBId : r.agentAId
      const other = allAgents.find(a => a.id === otherId)
      if (!other) return null
      const parts: string[] = [other.bio.name]
      if (r.romance > 30) parts.push(`романтика:${r.romance}`)
      if (r.friendship > 30 || r.friendship < -30) parts.push(`дружба:${r.friendship}`)
      if (r.rivalry > 30) parts.push(`вражда:${r.rivalry}`)
      if (r.trust < -20) parts.push(`не доверяю`)
      return parts.length > 1 ? parts.join(' ') : null
    })
    .filter(Boolean)
    .join('; ')

  const user = `Утро дня ${clock.day}. Ты просыпаешься в доме DOM2.
${dailySummary ? `Вчера: ${dailySummary}` : ''}
${reflectionText ? `Твои размышления:\n${reflectionText}` : ''}
${relSummary ? `Отношения: ${relSummary}` : ''}

Напиши план на день: 2-4 конкретные цели. Что ты хочешь сделать сегодня?
Примеры целей: "Поговорить с Кристиной наедине", "Избегать Руслана", "Узнать кто сплетничает обо мне", "Попытаться создать альянс с Тимуром".

Ответь СТРОГО JSON:
{"goals": ["цель 1", "цель 2", "цель 3"]}`

  const response = await llmGenerateJSON<LLMPlanResponse>(
    [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    'cheap'
  )

  return {
    agentId: agent.id,
    day: clock.day,
    goals: response.goals.slice(0, 4),
  }
}

function generateFallbackPlan(
  agent: Agent,
  allAgents: Agent[],
  relationshipGraph: RelationshipGraph,
  clock: GameClock,
): AgentPlan {
  const goals: string[] = []
  const others = allAgents.filter(a => a.id !== agent.id && !a.isEvicted)

  // Need-based goals
  if (agent.needs.socialNeed < 50) {
    const friend = others[Math.floor(Math.random() * others.length)]
    if (friend) goals.push(`Поговорить с ${friend.bio.name}`)
  }

  if (agent.needs.intimacyNeed < 40 && agent.traits.flirtatiousness > 40) {
    const target = others.filter(a => a.bio.gender !== agent.bio.gender)[0]
    if (target) goals.push(`Пофлиртовать с ${target.bio.name}`)
  }

  if (agent.traits.manipulativeness > 60) {
    goals.push('Узнать слабости других участников')
  }

  if (goals.length === 0) {
    goals.push('Наблюдать за обстановкой в доме')
  }

  return {
    agentId: agent.id,
    day: clock.day,
    goals,
  }
}
