import { describe, it, expect } from 'vitest'
import { Simulation } from './simulation'

describe('Simulation', () => {
  it('creates simulation with 3 agents', () => {
    const sim = new Simulation(false)
    expect(sim.state.agents.length).toBe(3)
  })

  it('creates simulation with clock at day 1', () => {
    const sim = new Simulation(false)
    expect(sim.state.clock.day).toBe(1)
    expect(sim.state.clock.hour).toBe(8)
  })

  it('starts and stops', () => {
    const sim = new Simulation(false)
    sim.start(100000) // large interval so it doesn't actually tick
    expect(sim.state.isRunning).toBe(true)
    sim.stop()
    expect(sim.state.isRunning).toBe(false)
  })

  it('processes a tick without errors (no LLM)', async () => {
    const sim = new Simulation(false)
    await sim.tick()
    expect(sim.state.clock.tick).toBe(1)
  })

  it('emits state_update events', async () => {
    const sim = new Simulation(false)
    const events: Array<{ type: string }> = []
    sim.onEvent(e => events.push(e))

    await sim.tick()

    const stateUpdate = events.find(e => e.type === 'state_update')
    expect(stateUpdate).toBeDefined()
  })

  it('agents sleep at night', async () => {
    const sim = new Simulation(false)
    // Advance to night time (00:00)
    // Start at 08:00, need 96 ticks to reach 00:00
    for (let i = 0; i < 96; i++) {
      await sim.tick()
    }
    expect(sim.state.clock.hour).toBe(0)

    // All non-evicted agents should be sleeping
    const activeAgents = sim.state.agents.filter(a => !a.isEvicted)
    for (const agent of activeAgents) {
      expect(agent.status).toBe('sleeping')
      expect(agent.location).toBe('bedroom')
    }
  })

  it('agents wake up in the morning', async () => {
    const sim = new Simulation(false)
    // Go through a full night cycle: 08:00 → 00:00 → 08:00 = 144 ticks
    for (let i = 0; i < 144; i++) {
      await sim.tick()
    }
    expect(sim.state.clock.hour).toBe(8)
    expect(sim.state.clock.day).toBe(2)

    // Agents should no longer be sleeping
    const activeAgents = sim.state.agents.filter(a => !a.isEvicted)
    for (const agent of activeAgents) {
      expect(agent.status).not.toBe('sleeping')
    }
  })

  it('serializes and restores from save', () => {
    const sim = new Simulation(false)
    const save = sim.saveState()

    expect(save.version).toBe(1)
    expect(save.state.agents.length).toBe(3)
    expect(save.subsystems.relationships).toBeDefined()
    expect(save.subsystems.shortTermMemories).toBeDefined()

    const sim2 = Simulation.fromSaveFile(save, false)
    expect(sim2.state.agents.length).toBe(3)
    expect(sim2.state.clock.day).toBe(sim.state.clock.day)
  })

  it('speed controls work', () => {
    const sim = new Simulation(false)
    expect(sim.getSpeed()).toBe(1)
    expect(sim.isPaused()).toBe(false)

    sim.pause()
    expect(sim.isPaused()).toBe(true)
    expect(sim.getSpeed()).toBe(0)

    sim.resume()
    expect(sim.isPaused()).toBe(false)

    sim.setSpeed(2)
    expect(sim.getSpeed()).toBe(2)

    sim.setSpeed(0)
    expect(sim.isPaused()).toBe(true)
  })

  it('generates catch-up data', () => {
    const sim = new Simulation(false)
    const data = sim.getCatchUpData()
    expect(data.activeAgentCount).toBe(3)
    expect(data.evictions).toHaveLength(0)
    expect(data.clock).toBeDefined()
  })
})
