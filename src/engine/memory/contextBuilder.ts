// Situation awareness layer — builds rich context for every prompt

import type { Agent, Memory, Relationship, GameClock } from '../types'
import { MemoryStore } from './memoryStore'

/**
 * Aggregates today's memories into a 3-5 sentence narrative.
 */
export function buildDailySummary(
  agentId: string,
  memoryStore: MemoryStore,
  clock: GameClock,
  agents: Agent[],
): string {
  const allMemories = memoryStore.getRecentMemories(agentId, 30)
  if (allMemories.length === 0) return 'Пока ничего значительного не произошло.'

  const nameMap = new Map(agents.map(a => [a.id, a.bio.name]))
  const getName = (id: string) => nameMap.get(id) ?? 'кто-то'

  // Get important ones
  const important = allMemories
    .filter(m => m.importance >= 4)
    .slice(-8)

  if (important.length === 0) return 'Спокойный день, ничего примечательного.'

  const parts: string[] = []
  for (const m of important) {
    const text = m.narrativeSummary ?? m.content
    parts.push(text)
  }

  return parts.slice(0, 5).join(' ')
}

/**
 * Detects and narrates ongoing storylines from relationship data + memories.
 */
export function buildActiveStorylines(
  relationships: Relationship[],
  agents: Agent[],
): string {
  const nameMap = new Map(agents.map(a => [a.id, a.bio.name]))
  const getName = (id: string) => nameMap.get(id) ?? 'кто-то'
  const lines: string[] = []

  // Detect love triangles: A has romance>30 with both B and C
  for (const a of agents) {
    const romances = relationships.filter(
      r => (r.agentAId === a.id || r.agentBId === a.id) && r.romance > 30
    )
    if (romances.length >= 2) {
      const partners = romances.map(r =>
        getName(r.agentAId === a.id ? r.agentBId : r.agentAId)
      ).slice(0, 2)
      lines.push(`Любовный треугольник: ${getName(a.id)} - ${partners.join(' / ')}`)
    }
  }

  // Detect active conflicts
  for (const r of relationships) {
    if (r.rivalry > 50) {
      lines.push(`Конфликт: ${getName(r.agentAId)} vs ${getName(r.agentBId)}`)
    }
  }

  // Detect alliances
  for (const r of relationships) {
    if (r.alliance) {
      lines.push(`Тайный альянс: ${getName(r.agentAId)} и ${getName(r.agentBId)}`)
    }
  }

  if (lines.length === 0) return ''
  return 'АКТИВНЫЕ СЮЖЕТЫ:\n' + lines.slice(0, 5).map(l => `- ${l}`).join('\n')
}

/**
 * Converts numeric relationship values to narrative.
 */
export function buildRelationshipNarrative(
  agentId: string,
  otherId: string,
  rel: Relationship | null,
  memoryStore: MemoryStore,
  agents: Agent[],
): string {
  if (!rel) return 'Вы ещё не знакомы.'

  const other = agents.find(a => a.id === otherId)
  const otherName = other?.bio.name ?? 'этот человек'
  const parts: string[] = []

  // Romance narrative
  if (rel.romance > 60 && rel.trust > 50) {
    parts.push(`У тебя настоящие чувства к ${otherName}, и ты доверяешь.`)
  } else if (rel.romance > 60 && rel.trust < 20) {
    parts.push(`Тебя тянет к ${otherName}, но ты не уверен(а) в искренности.`)
  } else if (rel.romance > 30) {
    parts.push(`Между тобой и ${otherName} что-то намечается.`)
  }

  // Friendship narrative
  if (rel.friendship > 50) {
    parts.push(`${otherName} — близкий человек, с которым можно поговорить.`)
  } else if (rel.friendship < -30) {
    parts.push(`${otherName} тебя раздражает.`)
  }

  // Trust narrative
  if (rel.trust < -40) {
    parts.push(`Ты не доверяешь ${otherName} совсем.`)
  } else if (rel.trust > 60) {
    parts.push(`Ты полностью доверяешь ${otherName}.`)
  }

  // Rivalry
  if (rel.rivalry > 50) {
    parts.push(`${otherName} — твой соперник/соперница. Между вами напряжение.`)
  }

  // Alliance
  if (rel.alliance) {
    parts.push(`У вас тайный альянс.`)
  }

  // Recent memories about this person
  const memories = memoryStore.getMemoriesAbout(agentId, otherId, 3)
  if (memories.length > 0) {
    const recentEvent = memories[0].narrativeSummary ?? memories[0].content
    parts.push(`Недавно: ${recentEvent}`)
  }

  return parts.join(' ') || `Отношения с ${otherName} пока нейтральные.`
}

/**
 * Collects gossip-type memories, formats as rumors.
 */
export function buildHouseGossip(
  agentId: string,
  memoryStore: MemoryStore,
  agents: Agent[],
): string {
  const gossipMemories = memoryStore.getGossipMemories(agentId, 5)
  if (gossipMemories.length === 0) return ''

  const nameMap = new Map(agents.map(a => [a.id, a.bio.name]))
  const lines = gossipMemories.map(m => {
    const source = m.sourceAgentId ? nameMap.get(m.sourceAgentId) : null
    const prefix = source ? `${source} рассказал(а)` : 'Ходят слухи'
    return `${prefix}: ${m.content}`
  })

  return 'СЛУХИ ПО ДОМУ:\n' + lines.map(l => `- ${l}`).join('\n')
}
