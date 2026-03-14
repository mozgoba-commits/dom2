import { describe, it, expect } from 'vitest'
import { createClock, advanceClock, isNightTime, formatGameTime, getMealType } from './clock'

describe('Clock', () => {
  it('creates clock at day 1, 08:00', () => {
    const clock = createClock()
    expect(clock.day).toBe(1)
    expect(clock.hour).toBe(8)
    expect(clock.minute).toBe(0)
    expect(clock.tick).toBe(0)
    expect(clock.timeOfDay).toBe('morning')
  })

  it('advances by 10 minutes per tick', () => {
    let clock = createClock()
    clock = advanceClock(clock)
    expect(clock.tick).toBe(1)
    expect(clock.minute).toBe(10)
    expect(clock.hour).toBe(8)
  })

  it('rolls over hour after 6 ticks', () => {
    let clock = createClock()
    for (let i = 0; i < 6; i++) clock = advanceClock(clock)
    expect(clock.hour).toBe(9)
    expect(clock.minute).toBe(0)
  })

  it('rolls over day after 24 hours', () => {
    let clock = createClock() // starts at 08:00
    // Need 16 hours to reach 00:00 (96 ticks) + 8 more to reach 08:00 next day (48 ticks)
    // Total ticks from 08:00 to next 08:00 = 144 ticks
    for (let i = 0; i < 144; i++) clock = advanceClock(clock)
    expect(clock.day).toBe(2)
    expect(clock.hour).toBe(8)
    expect(clock.minute).toBe(0)
  })

  it('identifies night time correctly', () => {
    let clock = createClock() // 08:00 - not night
    expect(isNightTime(clock)).toBe(false)

    // Advance to 00:00 (96 ticks from 08:00)
    for (let i = 0; i < 96; i++) clock = advanceClock(clock)
    expect(clock.hour).toBe(0)
    expect(isNightTime(clock)).toBe(true)
  })

  it('detects time of day transitions', () => {
    let clock = createClock() // morning
    expect(clock.timeOfDay).toBe('morning')

    // Advance to 12:00 (24 ticks from 08:00)
    for (let i = 0; i < 24; i++) clock = advanceClock(clock)
    expect(clock.timeOfDay).toBe('afternoon')

    // Advance to 17:00 (30 more ticks)
    for (let i = 0; i < 30; i++) clock = advanceClock(clock)
    expect(clock.timeOfDay).toBe('evening')
  })

  it('formats game time correctly', () => {
    const clock = createClock()
    expect(formatGameTime(clock)).toBe('День 1, 08:00')
  })

  it('detects meal times', () => {
    const clock = createClock()
    expect(getMealType(clock)).toBe('breakfast')

    let lunch = createClock()
    for (let i = 0; i < 30; i++) lunch = advanceClock(lunch) // 08:00 + 5h = 13:00
    expect(getMealType(lunch)).toBe('lunch')
  })
})
