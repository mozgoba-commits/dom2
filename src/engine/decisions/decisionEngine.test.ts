import { describe, it, expect } from 'vitest'
import { makeDecision } from './decisionEngine'
import { MemoryStore } from '../memory/memoryStore'
import { RelationshipGraph } from '../relationships/graph'
import type { Agent, GameClock } from '../types'

function makeAgent(overrides: Partial<Agent> = {}): Agent {
  return {
    id: 'test-agent',
    bio: {
      name: 'Тест', surname: 'Тестов', age: 25, gender: 'male',
      hometown: 'Москва', occupation: 'тестер', education: 'ВШЭ',
      hobbies: [], favoriteMusic: '', favoriteFood: '', fears: [],
      lifeGoal: '', reasonForComing: '', idealPartner: '',
      catchphrase: '', funFact: '', physicalDescription: '',
    },
    archetype: 'Тихий стратег',
    traits: {
      openness: 50, conscientiousness: 50, extraversion: 50,
      agreeableness: 50, neuroticism: 50,
      flirtatiousness: 50, jealousy: 50, loyalty: 50,
      manipulativeness: 50, dramaTendency: 50, humor: 50,
      stubbornness: 50, sensitivity: 50,
    },
    needs: { socialNeed: 50, validationNeed: 50, intimacyNeed: 50, dominanceNeed: 50 },
    emotions: {
      happiness: 50, anger: 0, sadness: 0, fear: 0,
      excitement: 0, jealousy: 0, love: 0, currentMood: 'neutral',
    },
    location: 'living_room',
    targetLocation: null,
    status: 'free',
    energy: 80,
    gossipUrge: 0,
    position: { x: 50, y: 50 },
    isEvicted: false,
    evictedOnDay: null,
    ...overrides,
  }
}

function makeClock(overrides: Partial<GameClock> = {}): GameClock {
  return {
    tick: 10, day: 1, hour: 12, minute: 0,
    timeOfDay: 'afternoon', ticksPerGameHour: 6,
    ...overrides,
  }
}

describe('DecisionEngine', () => {
  it('returns rest at night', async () => {
    const agent = makeAgent()
    const clock = makeClock({ hour: 2, timeOfDay: 'night' })
    const decision = await makeDecision(agent, [agent], clock, new MemoryStore(), new RelationshipGraph(), false)
    expect(decision.action).toBe('rest')
    expect(decision.targetLocation).toBe('bedroom')
  })

  it('returns rest when low energy', async () => {
    const agent = makeAgent({ energy: 10 })
    const clock = makeClock()
    const decision = await makeDecision(agent, [agent], clock, new MemoryStore(), new RelationshipGraph(), false)
    expect(decision.action).toBe('rest')
  })

  it('returns valid action type', async () => {
    const agent = makeAgent()
    const other = makeAgent({ id: 'other', bio: { ...makeAgent().bio, name: 'Другой' }, location: 'living_room' })
    const clock = makeClock()
    const decision = await makeDecision(agent, [agent, other], clock, new MemoryStore(), new RelationshipGraph(), false)

    const validActions = [
      'move', 'talk', 'flirt', 'argue', 'gossip', 'comfort',
      'manipulate', 'avoid', 'rest', 'think', 'cry', 'celebrate',
      'confront', 'apologize', 'form_alliance', 'break_alliance',
    ]
    expect(validActions).toContain(decision.action)
  })

  it('considers critical needs', async () => {
    const agent = makeAgent({
      needs: { socialNeed: 10, validationNeed: 50, intimacyNeed: 50, dominanceNeed: 50 },
    })
    const other = makeAgent({ id: 'other', bio: { ...makeAgent().bio, name: 'Другой' }, location: 'living_room' })
    const clock = makeClock()
    const decision = await makeDecision(agent, [agent, other], clock, new MemoryStore(), new RelationshipGraph(), false)

    // With critical social need and another agent nearby, should want to interact
    expect(['talk', 'gossip', 'comfort', 'flirt', 'confront', 'manipulate', 'form_alliance']).toContain(decision.action)
  })
})
