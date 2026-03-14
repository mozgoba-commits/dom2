import { GameClock, GameEvent, GameEventType, Agent, LocationId } from '../types'
import { getMealType, isMealTime } from '../clock'
import { nanoid } from 'nanoid'

export class EventScheduler {
  private events: GameEvent[] = []
  private lastTokShowDay = 0
  private lastVotingDay = 0

  getActiveEvents(): GameEvent[] {
    return this.events.filter(e => e.startedAtTick !== null && e.endedAtTick === null)
  }

  getScheduledEvents(): GameEvent[] {
    return this.events.filter(e => e.startedAtTick === null)
  }

  getAllEvents(): GameEvent[] {
    return [...this.events]
  }

  /**
   * Check clock and schedule/start/end events.
   */
  processTick(clock: GameClock, agents: Agent[]): GameEvent[] {
    const newEvents: GameEvent[] = []
    const activeAgents = agents.filter(a => !a.isEvicted)

    // --- Meals ---
    const meal = getMealType(clock)
    if (meal) {
      const event = this.createEvent(meal, clock.tick, 'kitchen', activeAgents.map(a => a.id))
      event.startedAtTick = clock.tick
      newEvents.push(event)
    }

    // End meal events after 3 ticks (30 game minutes)
    for (const event of this.getActiveEvents()) {
      if (['breakfast', 'lunch', 'dinner'].includes(event.type)) {
        if (event.startedAtTick !== null && clock.tick - event.startedAtTick >= 3) {
          event.endedAtTick = clock.tick
        }
      }
    }

    // --- Tok Show (every 2-3 days, at 17:00) ---
    if (
      clock.hour === 17 && clock.minute === 0 &&
      clock.day - this.lastTokShowDay >= 2
    ) {
      const event = this.createEvent('tok_show', clock.tick, 'yard', activeAgents.map(a => a.id))
      event.startedAtTick = clock.tick
      this.lastTokShowDay = clock.day
      newEvents.push(event)
    }

    // End tok show after 6 ticks (1 game hour)
    for (const event of this.getActiveEvents()) {
      if (event.type === 'tok_show' && event.startedAtTick !== null && clock.tick - event.startedAtTick >= 6) {
        event.endedAtTick = clock.tick
      }
    }

    // --- Voting (every 5-7 days, at 20:00) ---
    if (
      clock.hour === 20 && clock.minute === 0 &&
      clock.day - this.lastVotingDay >= 5 &&
      clock.day >= 5
    ) {
      const event = this.createEvent('voting', clock.tick, 'yard', activeAgents.map(a => a.id))
      event.startedAtTick = clock.tick
      this.lastVotingDay = clock.day
      newEvents.push(event)
    }

    // End voting after 6 ticks
    for (const event of this.getActiveEvents()) {
      if (event.type === 'voting' && event.startedAtTick !== null && clock.tick - event.startedAtTick >= 6) {
        event.endedAtTick = clock.tick
      }
    }

    // --- Confessional (at 23:00) ---
    if (clock.hour === 23 && clock.minute === 0) {
      // Pick 1-2 agents with highest drama potential
      const sorted = [...activeAgents].sort((a, b) => {
        const scoreA = a.emotions.anger + a.emotions.jealousy + a.emotions.sadness + a.traits.dramaTendency
        const scoreB = b.emotions.anger + b.emotions.jealousy + b.emotions.sadness + b.traits.dramaTendency
        return scoreB - scoreA
      })
      const confessees = sorted.slice(0, Math.random() > 0.5 ? 2 : 1)
      for (const agent of confessees) {
        const event = this.createEvent('confessional', clock.tick, 'confessional', [agent.id])
        event.startedAtTick = clock.tick
        newEvents.push(event)
      }
    }

    // End confessional after 2 ticks
    for (const event of this.getActiveEvents()) {
      if (event.type === 'confessional' && event.startedAtTick !== null && clock.tick - event.startedAtTick >= 2) {
        event.endedAtTick = clock.tick
      }
    }

    // --- Sleep (00:00 - 08:00) ---
    if (clock.hour === 0 && clock.minute === 0) {
      const event = this.createEvent('sleep', clock.tick, 'bedroom', activeAgents.map(a => a.id))
      event.startedAtTick = clock.tick
      newEvents.push(event)
    }
    if (clock.hour === 8 && clock.minute === 0) {
      for (const event of this.getActiveEvents()) {
        if (event.type === 'sleep') event.endedAtTick = clock.tick
      }
    }

    return newEvents
  }

  private createEvent(
    type: GameEventType,
    scheduledTick: number,
    location: LocationId,
    involvedAgents: string[]
  ): GameEvent {
    const event: GameEvent = {
      id: nanoid(),
      type,
      scheduledTick,
      startedAtTick: null,
      endedAtTick: null,
      location,
      involvedAgents,
    }
    this.events.push(event)
    return event
  }
}
