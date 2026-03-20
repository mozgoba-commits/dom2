import { Agent, VotingSession, GameEvent } from '../types'
import { RelationshipGraph } from '../relationships/graph'
import { nanoid } from 'nanoid'

export class VotingEngine {
  private sessions: VotingSession[] = []

  startVoting(day: number, agents: Agent[], relationships: RelationshipGraph): VotingSession {
    const activeAgents = agents.filter(a => !a.isEvicted)

    // Each agent nominates someone (the person they like least)
    const nominations: Record<string, number> = {}

    for (const agent of activeAgents) {
      const rels = relationships.getForAgent(agent.id)
      let worstTarget: string | null = null
      let worstScore = Infinity

      for (const rel of rels) {
        const otherId = rel.agentAId === agent.id ? rel.agentBId : rel.agentAId
        const other = activeAgents.find(a => a.id === otherId)
        if (!other) continue

        // Score = friendship + trust - rivalry (lower = more likely to vote out)
        const score = rel.friendship + rel.trust - rel.rivalry
        if (score < worstScore) {
          worstScore = score
          worstTarget = otherId
        }
      }

      if (worstTarget) {
        nominations[worstTarget] = (nominations[worstTarget] ?? 0) + 1
      }
    }

    // Top 2-3 nominees
    const sorted = Object.entries(nominations)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([id]) => id)

    // If less than 2, add random
    while (sorted.length < 2) {
      const random = activeAgents[Math.floor(Math.random() * activeAgents.length)]
      if (!sorted.includes(random.id)) sorted.push(random.id)
    }

    const session: VotingSession = {
      id: nanoid(),
      day,
      nominees: sorted,
      votes: {},
      userVotes: {},
      result: null,
      isActive: true,
    }

    this.sessions.push(session)
    return session
  }

  /**
   * Each agent casts their vote.
   */
  castAgentVotes(
    session: VotingSession,
    agents: Agent[],
    relationships: RelationshipGraph
  ) {
    const voters = agents.filter(
      a => !a.isEvicted && !session.nominees.includes(a.id)
    )

    for (const voter of voters) {
      let chosenNominee: string | null = null
      let worstScore = Infinity

      for (const nomineeId of session.nominees) {
        const rel = relationships.get(voter.id, nomineeId)
        const score = rel
          ? rel.friendship + rel.trust - rel.rivalry
          : 0

        // Add personality-based bias
        const biasedScore = score +
          (voter.traits.manipulativeness > 60 ? -10 : 0) + // manipulators vote strategically
          (voter.traits.loyalty > 70 && rel?.alliance ? 50 : 0)  // loyal to allies

        if (biasedScore < worstScore) {
          worstScore = biasedScore
          chosenNominee = nomineeId
        }
      }

      if (chosenNominee) {
        session.votes[voter.id] = chosenNominee
      }
    }
  }

  /**
   * Add a user vote.
   */
  addUserVote(sessionId: string, visitorId: string, nomineeId: string): boolean {
    const session = this.sessions.find(s => s.id === sessionId)
    if (!session || !session.isActive) return false
    if (!session.nominees.includes(nomineeId)) return false

    session.userVotes[visitorId] = nomineeId
    return true
  }

  /**
   * Tally votes and determine who gets evicted.
   */
  tallyVotes(sessionId: string): string | null {
    const session = this.sessions.find(s => s.id === sessionId)
    if (!session) return null

    const tally: Record<string, number> = {}
    for (const nomineeId of session.nominees) tally[nomineeId] = 0

    // Agent votes (weight: 1)
    for (const nomineeId of Object.values(session.votes)) {
      tally[nomineeId] = (tally[nomineeId] ?? 0) + 1
    }

    // User votes (weight: 0.5 each, capped at total agent votes)
    const agentVoteCount = Object.keys(session.votes).length
    const userVoteWeight = Math.min(
      agentVoteCount,
      Object.keys(session.userVotes).length * 0.5
    ) / Math.max(1, Object.keys(session.userVotes).length)

    for (const nomineeId of Object.values(session.userVotes)) {
      tally[nomineeId] = (tally[nomineeId] ?? 0) + userVoteWeight
    }

    // Find the one with most votes
    const sorted = Object.entries(tally).sort(([, a], [, b]) => b - a)
    const evicted = sorted[0]?.[0] ?? null

    session.result = evicted
    session.isActive = false

    return evicted
  }

  getActiveSession(): VotingSession | null {
    return this.sessions.find(s => s.isActive) ?? null
  }

  getSessionByDay(day: number): VotingSession | null {
    return this.sessions.find(s => s.day === day) ?? null
  }

  getAllSessions(): VotingSession[] {
    return [...this.sessions]
  }

  /** Serialize for persistence */
  toJSON(): VotingSession[] {
    return [...this.sessions]
  }

  /** Load from save data */
  loadData(sessions: VotingSession[]) {
    this.sessions = sessions
  }
}
