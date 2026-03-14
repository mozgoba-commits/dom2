import { describe, it, expect } from 'vitest'
import { EventScheduler } from './scheduler'
import type { Agent, GameClock } from '../types'

function makeClock(overrides: Partial<GameClock> = {}): GameClock {
  return {
    tick: 10, day: 1, hour: 12, minute: 0,
    timeOfDay: 'afternoon', ticksPerGameHour: 6,
    ...overrides,
  }
}

function makeAgents(count = 4): Agent[] {
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

describe('EventScheduler', () => {
  it('triggers breakfast at 08:00', () => {
    const scheduler = new EventScheduler()
    const clock = makeClock({ hour: 8, minute: 0 })
    const events = scheduler.processTick(clock, makeAgents())
    const breakfast = events.find(e => e.type === 'breakfast')
    expect(breakfast).toBeDefined()
    expect(breakfast!.location).toBe('kitchen')
  })

  it('triggers lunch at 13:00', () => {
    const scheduler = new EventScheduler()
    const clock = makeClock({ hour: 13, minute: 0 })
    const events = scheduler.processTick(clock, makeAgents())
    const lunch = events.find(e => e.type === 'lunch')
    expect(lunch).toBeDefined()
  })

  it('triggers tok show at 17:00', () => {
    const scheduler = new EventScheduler()
    const clock = makeClock({ hour: 17, minute: 0, day: 3 })
    const events = scheduler.processTick(clock, makeAgents())
    const tokShow = events.find(e => e.type === 'tok_show')
    expect(tokShow).toBeDefined()
    expect(tokShow!.location).toBe('yard')
  })

  it('triggers voting at 20:00 after day 5', () => {
    const scheduler = new EventScheduler()
    const clock = makeClock({ hour: 20, minute: 0, day: 6 })
    const events = scheduler.processTick(clock, makeAgents())
    const voting = events.find(e => e.type === 'voting')
    expect(voting).toBeDefined()
  })

  it('does not trigger voting before day 5', () => {
    const scheduler = new EventScheduler()
    const clock = makeClock({ hour: 20, minute: 0, day: 3 })
    const events = scheduler.processTick(clock, makeAgents())
    const voting = events.find(e => e.type === 'voting')
    expect(voting).toBeUndefined()
  })

  it('triggers confessional at 23:00', () => {
    const scheduler = new EventScheduler()
    const clock = makeClock({ hour: 23, minute: 0 })
    const events = scheduler.processTick(clock, makeAgents())
    const confessional = events.filter(e => e.type === 'confessional')
    expect(confessional.length).toBeGreaterThanOrEqual(1)
    expect(confessional.length).toBeLessThanOrEqual(2)
  })

  it('serializes and loads state', () => {
    const scheduler = new EventScheduler()
    // Trigger tok show to set lastTokShowDay
    scheduler.processTick(makeClock({ hour: 17, minute: 0, day: 3 }), makeAgents())

    const json = scheduler.toJSON()
    expect(json.lastTokShowDay).toBe(3)

    const scheduler2 = new EventScheduler()
    scheduler2.loadData(json)
    // Should not trigger tok show again on same day
    const events = scheduler2.processTick(makeClock({ hour: 17, minute: 0, day: 3, tick: 100 }), makeAgents())
    expect(events.find(e => e.type === 'tok_show')).toBeUndefined()
  })
})
