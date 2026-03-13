import { Agent, DramaScore, Conversation, Relationship } from '../types'
import { RelationshipGraph } from '../relationships/graph'

export function createDramaScore(): DramaScore {
  return {
    overall: 30,
    conflicts: 0,
    romances: 0,
    betrayals: 0,
    alliances: 0,
    lastMajorEvent: null,
    ticksSinceLastDrama: 0,
  }
}

/**
 * Analyze current state and calculate drama score.
 */
export function detectDrama(
  agents: Agent[],
  relationships: RelationshipGraph,
  conversations: Conversation[],
  previousScore: DramaScore
): DramaScore {
  const allRels = relationships.getAll()
  let conflicts = 0
  let romances = 0
  let betrayals = 0
  let alliances = 0

  for (const rel of allRels) {
    if (rel.rivalry > 50) conflicts++
    if (rel.romance > 50) romances++
    if (rel.trust < -50) betrayals++
    if (rel.alliance) alliances++
  }

  // Check active conversations for drama keywords
  const activeConvs = conversations.filter(c => c.endedAtTick === null)
  let conversationDrama = 0
  for (const conv of activeConvs) {
    for (const msg of conv.messages.slice(-3)) {
      const text = msg.content.toLowerCase()
      if (
        text.includes('предатель') || text.includes('ненавиж') ||
        text.includes('люблю') || text.includes('уходи') ||
        text.includes('враг') || text.includes('ты мне отвратител')
      ) {
        conversationDrama += 10
      }
    }
  }

  // Emotional state drama
  let emotionalDrama = 0
  for (const agent of agents) {
    if (agent.isEvicted) continue
    if (agent.emotions.anger > 70) emotionalDrama += 5
    if (agent.emotions.jealousy > 60) emotionalDrama += 5
    if (agent.emotions.sadness > 80) emotionalDrama += 3
    if (agent.emotions.love > 70) emotionalDrama += 3
  }

  const overall = Math.min(100, Math.max(0,
    conflicts * 10 +
    romances * 8 +
    betrayals * 15 +
    alliances * 3 +
    conversationDrama +
    emotionalDrama
  ))

  const ticksSinceLastDrama = overall > 60
    ? 0
    : previousScore.ticksSinceLastDrama + 1

  return {
    overall,
    conflicts,
    romances,
    betrayals,
    alliances,
    lastMajorEvent: overall > 70 ? `Уровень драмы: ${overall}` : previousScore.lastMajorEvent,
    ticksSinceLastDrama,
  }
}

/**
 * Generate drama alerts for viewers.
 */
export function getDramaAlerts(
  agents: Agent[],
  relationships: RelationshipGraph
): string[] {
  const alerts: string[] = []
  const allRels = relationships.getAll()

  for (const rel of allRels) {
    const a = agents.find(ag => ag.id === rel.agentAId)
    const b = agents.find(ag => ag.id === rel.agentBId)
    if (!a || !b) continue

    if (rel.rivalry > 70) {
      alerts.push(`${a.bio.name} и ${b.bio.name} на грани конфликта!`)
    }
    if (rel.romance > 70) {
      alerts.push(`Между ${a.bio.name} и ${b.bio.name} вспыхнули чувства!`)
    }
    if (rel.trust < -60 && rel.history.length > 0) {
      alerts.push(`${a.bio.name} больше не доверяет ${b.bio.name}!`)
    }
  }

  // Emotional breakdowns
  for (const agent of agents) {
    if (agent.isEvicted) continue
    if (agent.emotions.sadness > 85) {
      alerts.push(`${agent.bio.name} на грани нервного срыва!`)
    }
    if (agent.emotions.anger > 85) {
      alerts.push(`${agent.bio.name} в ярости!`)
    }
  }

  return alerts
}
