import { describe, it, expect } from 'vitest'
import { VotingEngine } from './voting'
import { RelationshipGraph } from '../relationships/graph'
import type { Agent } from '../types'

function makeAgents(count = 6): Agent[] {
  return Array.from({ length: count }, (_, i) => ({
    id: `agent-${i}`,
    bio: { name: `Agent${i}`, surname: '', age: 25, gender: 'male' as const, hometown: '', occupation: '', education: '', hobbies: [], favoriteMusic: '', favoriteFood: '', fears: [], lifeGoal: '', reasonForComing: '', idealPartner: '', catchphrase: '', funFact: '', physicalDescription: '' },
    archetype: 'Тихий стратег',
    traits: { openness: 50, conscientiousness: 50, extraversion: 50, agreeableness: 50, neuroticism: 50, flirtatiousness: 50, jealousy: 50, loyalty: 50, manipulativeness: 50, dramaTendency: 50, humor: 50, stubbornness: 50, sensitivity: 50 },
    needs: { socialNeed: 50, validationNeed: 50, intimacyNeed: 50, dominanceNeed: 50 },
    emotions: { happiness: 50, anger: 0, sadness: 0, fear: 0, excitement: 0, jealousy: 0, love: 0, currentMood: 'neutral' as const },
    location: 'living_room' as const,
    targetLocation: null,
    status: 'free' as const,
    energy: 80,
    gossipUrge: 0,
    position: { x: 50, y: 50 },
    isEvicted: false,
    evictedOnDay: null,
  }))
}

describe('VotingEngine', () => {
  it('starts a voting session with nominees', () => {
    const engine = new VotingEngine()
    const agents = makeAgents()
    const graph = new RelationshipGraph()

    // Create some relationships to generate nominations
    graph.update('agent-0', 'agent-1', { friendship: -50, rivalry: 40 })
    graph.update('agent-2', 'agent-1', { friendship: -30, rivalry: 30 })

    const session = engine.startVoting(5, agents, graph)
    expect(session.isActive).toBe(true)
    expect(session.nominees.length).toBeGreaterThanOrEqual(2)
    expect(session.day).toBe(5)
  })

  it('casts agent votes', () => {
    const engine = new VotingEngine()
    const agents = makeAgents()
    const graph = new RelationshipGraph()

    const session = engine.startVoting(5, agents, graph)
    engine.castAgentVotes(session, agents, graph)

    // Non-nominee agents should have voted
    const voterCount = Object.keys(session.votes).length
    expect(voterCount).toBeGreaterThan(0)
  })

  it('accepts user votes for valid nominees', () => {
    const engine = new VotingEngine()
    const agents = makeAgents()
    const graph = new RelationshipGraph()

    const session = engine.startVoting(5, agents, graph)
    const nomineeId = session.nominees[0]

    const ok = engine.addUserVote(session.id, 'visitor-1', nomineeId)
    expect(ok).toBe(true)
    expect(session.userVotes['visitor-1']).toBe(nomineeId)
  })

  it('rejects user votes for non-nominees', () => {
    const engine = new VotingEngine()
    const agents = makeAgents()
    const graph = new RelationshipGraph()

    const session = engine.startVoting(5, agents, graph)
    const ok = engine.addUserVote(session.id, 'visitor-1', 'non-existent')
    expect(ok).toBe(false)
  })

  it('tallies votes and returns evicted agent', () => {
    const engine = new VotingEngine()
    const agents = makeAgents()
    const graph = new RelationshipGraph()

    const session = engine.startVoting(5, agents, graph)
    engine.castAgentVotes(session, agents, graph)

    const evictedId = engine.tallyVotes(session.id)
    expect(evictedId).not.toBeNull()
    expect(session.nominees).toContain(evictedId)
    expect(session.isActive).toBe(false)
  })

  it('returns active session', () => {
    const engine = new VotingEngine()
    expect(engine.getActiveSession()).toBeNull()

    const agents = makeAgents()
    const graph = new RelationshipGraph()
    engine.startVoting(5, agents, graph)

    expect(engine.getActiveSession()).not.toBeNull()
  })

  it('serializes and loads correctly', () => {
    const engine = new VotingEngine()
    const agents = makeAgents()
    const graph = new RelationshipGraph()

    engine.startVoting(5, agents, graph)
    const json = engine.toJSON()

    const engine2 = new VotingEngine()
    engine2.loadData(json)
    expect(engine2.getActiveSession()).not.toBeNull()
  })
})
