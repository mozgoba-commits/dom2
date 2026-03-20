import { GameClock } from './types'

const TICKS_PER_GAME_HOUR = 6  // 1 tick = 10 game minutes, 6 ticks = 1 hour
const HOURS_PER_DAY = 24

export function createClock(): GameClock {
  return {
    tick: 0,
    day: 1,
    hour: 8,
    minute: 0,
    timeOfDay: 'morning',
    ticksPerGameHour: TICKS_PER_GAME_HOUR,
  }
}

export function advanceClock(clock: GameClock): GameClock {
  const newTick = clock.tick + 1
  let minute = clock.minute + 10
  let hour = clock.hour
  let day = clock.day

  if (minute >= 60) {
    minute = 0
    hour += 1
  }
  if (hour >= HOURS_PER_DAY) {
    hour = 0
    day += 1
  }

  return {
    tick: newTick,
    day,
    hour,
    minute,
    timeOfDay: getTimeOfDay(hour),
    ticksPerGameHour: TICKS_PER_GAME_HOUR,
  }
}

function getTimeOfDay(hour: number): GameClock['timeOfDay'] {
  if (hour >= 6 && hour < 12) return 'morning'
  if (hour >= 12 && hour < 17) return 'afternoon'
  if (hour >= 17 && hour < 23) return 'evening'
  return 'night'
}

export function formatGameTime(clock: GameClock): string {
  const h = String(clock.hour).padStart(2, '0')
  const m = String(clock.minute).padStart(2, '0')
  return `День ${clock.day}, ${h}:${m}`
}

export function isNightTime(clock: GameClock): boolean {
  return clock.hour >= 0 && clock.hour < 8
}

export function isMealTime(clock: GameClock): boolean {
  return (
    (clock.hour === 8 && clock.minute === 0) ||
    (clock.hour === 13 && clock.minute === 0) ||
    (clock.hour === 19 && clock.minute === 0)
  )
}

export function getMealType(clock: GameClock): 'breakfast' | 'lunch' | 'dinner' | null {
  if (clock.hour === 8 && clock.minute === 0) return 'breakfast'
  if (clock.hour === 13 && clock.minute === 0) return 'lunch'
  if (clock.hour === 19 && clock.minute === 0) return 'dinner'
  return null
}
