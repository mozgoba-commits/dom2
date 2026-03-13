import { Relationship, RelationshipEvent } from '../types'

export class RelationshipGraph {
  private relationships: Map<string, Relationship> = new Map()

  private key(a: string, b: string): string {
    return [a, b].sort().join(':')
  }

  get(agentAId: string, agentBId: string): Relationship | null {
    return this.relationships.get(this.key(agentAId, agentBId)) ?? null
  }

  getOrCreate(agentAId: string, agentBId: string): Relationship {
    const k = this.key(agentAId, agentBId)
    if (!this.relationships.has(k)) {
      this.relationships.set(k, {
        agentAId: [agentAId, agentBId].sort()[0],
        agentBId: [agentAId, agentBId].sort()[1],
        friendship: 0,
        romance: 0,
        trust: 0,
        rivalry: 0,
        alliance: false,
        history: [],
      })
    }
    return this.relationships.get(k)!
  }

  getAll(): Relationship[] {
    return [...this.relationships.values()]
  }

  getForAgent(agentId: string): Relationship[] {
    return [...this.relationships.values()].filter(
      r => r.agentAId === agentId || r.agentBId === agentId
    )
  }

  update(
    agentAId: string,
    agentBId: string,
    delta: Partial<Pick<Relationship, 'friendship' | 'romance' | 'trust' | 'rivalry'>>,
    event?: RelationshipEvent
  ): Relationship {
    const rel = this.getOrCreate(agentAId, agentBId)

    if (delta.friendship !== undefined)
      rel.friendship = clamp(rel.friendship + delta.friendship, -100, 100)
    if (delta.romance !== undefined)
      rel.romance = clamp(rel.romance + delta.romance, 0, 100)
    if (delta.trust !== undefined)
      rel.trust = clamp(rel.trust + delta.trust, -100, 100)
    if (delta.rivalry !== undefined)
      rel.rivalry = clamp(rel.rivalry + delta.rivalry, 0, 100)

    if (event) {
      rel.history.push(event)
      // Keep history manageable
      if (rel.history.length > 50) rel.history.shift()
    }

    return rel
  }

  setAlliance(agentAId: string, agentBId: string, active: boolean) {
    const rel = this.getOrCreate(agentAId, agentBId)
    rel.alliance = active
  }

  /**
   * Get the closest positive relationships for an agent.
   */
  getFriends(agentId: string, minFriendship = 30): Relationship[] {
    return this.getForAgent(agentId)
      .filter(r => r.friendship >= minFriendship)
      .sort((a, b) => b.friendship - a.friendship)
  }

  /**
   * Get the strongest rivalries for an agent.
   */
  getRivals(agentId: string, minRivalry = 30): Relationship[] {
    return this.getForAgent(agentId)
      .filter(r => r.rivalry >= minRivalry)
      .sort((a, b) => b.rivalry - a.rivalry)
  }

  /**
   * Get romantic interests for an agent.
   */
  getRomanticInterests(agentId: string, minRomance = 30): Relationship[] {
    return this.getForAgent(agentId)
      .filter(r => r.romance >= minRomance)
      .sort((a, b) => b.romance - a.romance)
  }
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val))
}
