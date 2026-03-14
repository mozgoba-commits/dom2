import { Memory, LocationId } from '../types'
import { nanoid } from 'nanoid'

const SHORT_TERM_LIMIT = 50
const LONG_TERM_LIMIT = 200

export class MemoryStore {
  private shortTerm: Map<string, Memory[]> = new Map()  // agentId → recent memories
  private longTerm: Map<string, Memory[]> = new Map()    // agentId → important memories

  addMemory(
    agentId: string,
    tick: number,
    type: Memory['type'],
    content: string,
    importance: number,
    involvedAgents: string[],
    location: LocationId,
    isGossip = false,
    sourceAgentId?: string,
    emotionalContext?: string,
    narrativeSummary?: string,
  ): Memory {
    const memory: Memory = {
      id: nanoid(),
      agentId,
      tick,
      type,
      content,
      importance,
      involvedAgents,
      location,
      isGossip,
      sourceAgentId,
      emotionalContext,
      narrativeSummary,
    }

    // Add to short-term
    if (!this.shortTerm.has(agentId)) this.shortTerm.set(agentId, [])
    const st = this.shortTerm.get(agentId)!
    st.push(memory)
    if (st.length > SHORT_TERM_LIMIT) st.shift()

    // If important enough, add to long-term
    if (importance >= 5) {
      if (!this.longTerm.has(agentId)) this.longTerm.set(agentId, [])
      const lt = this.longTerm.get(agentId)!
      lt.push(memory)
      if (lt.length > LONG_TERM_LIMIT) {
        // Remove least important
        lt.sort((a, b) => b.importance - a.importance)
        lt.pop()
      }
    }

    return memory
  }

  getRecentMemories(agentId: string, count = 10): Memory[] {
    const st = this.shortTerm.get(agentId) ?? []
    return st.slice(-count)
  }

  getImportantMemories(agentId: string, count = 10): Memory[] {
    const lt = this.longTerm.get(agentId) ?? []
    return lt
      .sort((a, b) => b.importance - a.importance)
      .slice(0, count)
  }

  getMemoriesAbout(agentId: string, aboutAgentId: string, count = 5): Memory[] {
    const all = [
      ...(this.shortTerm.get(agentId) ?? []),
      ...(this.longTerm.get(agentId) ?? []),
    ]
    return all
      .filter(m => m.involvedAgents.includes(aboutAgentId))
      .sort((a, b) => {
        // Prefer memories with narrative summaries
        const aNarr = a.narrativeSummary ? 1 : 0
        const bNarr = b.narrativeSummary ? 1 : 0
        if (aNarr !== bNarr) return bNarr - aNarr
        return b.tick - a.tick
      })
      .slice(0, count)
  }

  getGossipMemories(agentId: string, count = 5): Memory[] {
    const all = [
      ...(this.shortTerm.get(agentId) ?? []),
      ...(this.longTerm.get(agentId) ?? []),
    ]
    return all
      .filter(m => m.isGossip)
      .sort((a, b) => b.tick - a.tick)
      .slice(0, count)
  }

  /**
   * Retrieve memories relevant to a query, weighted by recency + importance.
   */
  retrieveRelevant(
    agentId: string,
    currentTick: number,
    involvedAgentIds: string[],
    count = 10
  ): Memory[] {
    const all = [
      ...(this.shortTerm.get(agentId) ?? []),
      ...(this.longTerm.get(agentId) ?? []),
    ]

    // Deduplicate by id
    const unique = new Map<string, Memory>()
    for (const m of all) unique.set(m.id, m)

    const scored = [...unique.values()].map(m => {
      const recencyScore = Math.max(0, 1 - (currentTick - m.tick) / 200)
      const importanceScore = m.importance / 10
      const relevanceScore = involvedAgentIds.some(id => m.involvedAgents.includes(id)) ? 1 : 0
      const gossipBonus = m.isGossip ? 0.3 : 0
      return {
        memory: m,
        score: recencyScore * 0.3 + importanceScore * 0.4 + relevanceScore * 0.2 + gossipBonus * 0.1,
      }
    })

    scored.sort((a, b) => b.score - a.score)
    return scored.slice(0, count).map(s => s.memory)
  }

  getAllMemories(agentId: string): Memory[] {
    return [
      ...(this.shortTerm.get(agentId) ?? []),
      ...(this.longTerm.get(agentId) ?? []),
    ]
  }

  getReflections(agentId: string, count = 5): Memory[] {
    const all = this.getAllMemories(agentId)
    return all
      .filter(m => m.type === 'reflection')
      .sort((a, b) => b.tick - a.tick)
      .slice(0, count)
  }

  getMemoriesSince(agentId: string, sinceTick: number): Memory[] {
    const all = this.getAllMemories(agentId)
    const unique = new Map<string, Memory>()
    for (const m of all) {
      if (m.tick >= sinceTick) unique.set(m.id, m)
    }
    return [...unique.values()].sort((a, b) => a.tick - b.tick)
  }
}
