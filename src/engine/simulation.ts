import {
  Agent, SimulationState, SSEEvent, LocationId, GameEvent, Relationship, EpisodeInfo,
} from './types'
import { createClock, advanceClock, isNightTime, formatGameTime } from './clock'
import { createStartingCast } from './agents/presets'
import {
  decayNeeds, decayEmotions, decayEnergy, recoverEnergy,
  satisfyNeed, applyEmotionalImpact,
  applyEmotionalContagion, calculateStressLevel,
} from './agents/personality'
import { makeDecision } from './decisions/decisionEngine'
import { ConversationEngine } from './conversations/conversationEngine'
import { MemoryStore } from './memory/memoryStore'
import { RelationshipGraph } from './relationships/graph'
import { EventScheduler } from './events/scheduler'
import { VotingEngine } from './events/voting'
import { detectDrama, createDramaScore, getDramaAlerts } from './drama/dramaDetector'
import { amplifyDrama, shouldTriggerEvent } from './drama/dramaAmplifier'
import { applyInteraction, checkJealousyTrigger } from './relationships/dynamics'
import { runTokShow } from './events/tokShow'
import { calculateImportance } from './memory/importance'
import { generateReflection } from './memory/reflectionEngine'
import { generateDayPlan } from './agents/planner'
import { OLD_ROOM_BOUNDS } from './coordinates'
import { budgetTracker } from './llm/budgetTracker'
import { saveSimulation, type SaveFile } from './persistence'
import { exportGossipItems, importGossipItems } from './memory/gossipNetwork'
import { calculateEpisode, isVotingDay, isTokShowDay, determineWinner } from './episodes/episodeManager'

// --- Constants ---
const TICK_INTERVAL_MS = 5000
const BATHROOM_CHANCE = 0.15
const IDLE_WANDER_CHANCE = 0.4
const WANDER_TICK_INTERVAL = 3
const ALERT_DEDUP_WINDOW = 30
const ALERT_CLEANUP_INTERVAL = 60
const REFLECTION_INTERVAL = 30
const MAX_REFLECTIONS_PER_TICK = 2
const AUTO_SAVE_INTERVAL = 10 // save every 10 ticks (~50s)
const BUDGET_LOG_INTERVAL = 12 // log stats every 12 ticks (~1 min)

export type SimulationEventHandler = (event: SSEEvent) => void

export class Simulation {
  state: SimulationState
  private memoryStore: MemoryStore
  private relationshipGraph: RelationshipGraph
  private conversationEngine: ConversationEngine
  private eventScheduler: EventScheduler
  private votingEngine: VotingEngine
  private eventHandlers: SimulationEventHandler[] = []
  private tickInterval: ReturnType<typeof setInterval> | null = null
  private useLLM: boolean
  private recentAlerts: Map<string, number> = new Map() // alert text -> tick when last sent
  private lastReflectionTick = 0
  private reflectionRotation = 0 // index into agents array for fair rotation
  private lastPlanDay = 0

  // Speed controls
  private speedMultiplier = 1
  private _isPaused = false
  private baseTickIntervalMs = TICK_INTERVAL_MS

  // Episode tracking
  private currentEpisode: EpisodeInfo | null = null
  private finaleEmitted = false

  constructor(useLLM = true) {
    this.useLLM = useLLM
    this.memoryStore = new MemoryStore()
    this.relationshipGraph = new RelationshipGraph()
    this.conversationEngine = new ConversationEngine()
    this.eventScheduler = new EventScheduler()
    this.votingEngine = new VotingEngine()

    const agents = createStartingCast()
    // Scatter agents across locations
    const locations: LocationId[] = ['yard', 'living_room', 'kitchen']
    agents.forEach((a, i) => {
      a.location = locations[i % locations.length]
      a.position = getLocationPosition(a.location, i)
    })

    this.state = {
      agents,
      relationships: [],
      conversations: [],
      activeEvents: [],
      clock: createClock(),
      drama: createDramaScore(),
      isRunning: false,
      votingQueue: [],
    }
  }

  /** Construct simulation from a saved state */
  static fromSaveFile(save: SaveFile, useLLM: boolean): Simulation {
    const sim = new Simulation(useLLM)

    // Restore state
    sim.state.agents = save.state.agents
    sim.state.clock = save.state.clock
    sim.state.drama = save.state.drama
    sim.state.votingQueue = save.state.votingQueue

    // Restore subsystems
    sim.relationshipGraph.loadData(save.subsystems.relationships)

    sim.memoryStore.loadData({
      shortTerm: save.subsystems.shortTermMemories,
      longTerm: save.subsystems.longTermMemories,
    })

    // Filter only active conversations for loading (ended ones don't need to be tracked)
    const activeConvs = save.subsystems.conversations
      .map(({ _raw, ...conv }) => conv)
      .filter(c => c.endedAtTick === null)
    sim.conversationEngine.loadData(activeConvs)

    sim.eventScheduler.loadData({
      events: save.subsystems.events,
      lastTokShowDay: save.subsystems.schedulerState.lastTokShowDay,
      lastVotingDay: save.subsystems.schedulerState.lastVotingDay,
    })

    sim.votingEngine.loadData(save.subsystems.votingSessions)

    if (save.subsystems.gossipItems) {
      importGossipItems(save.subsystems.gossipItems)
    }

    // Restore simulation meta
    sim.lastReflectionTick = save.simulationMeta.lastReflectionTick
    sim.reflectionRotation = save.simulationMeta.reflectionRotation
    sim.lastPlanDay = save.simulationMeta.lastPlanDay
    for (const [k, v] of save.simulationMeta.recentAlerts) {
      sim.recentAlerts.set(k, v)
    }

    console.log(`[Persistence] Restored simulation from save. Day ${save.state.clock.day}, Tick ${save.state.clock.tick}`)
    return sim
  }

  /** Serialize full simulation state for persistence */
  saveState(): SaveFile {
    const memData = this.memoryStore.toJSON()
    const schedulerData = this.eventScheduler.toJSON()

    return {
      version: 1,
      savedAt: new Date().toISOString(),
      state: {
        agents: this.state.agents,
        clock: this.state.clock,
        drama: this.state.drama,
        isRunning: this.state.isRunning,
        votingQueue: this.state.votingQueue,
      },
      subsystems: {
        relationships: this.relationshipGraph.toJSON(),
        shortTermMemories: memData.shortTerm,
        longTermMemories: memData.longTerm,
        conversations: this.conversationEngine.toJSON().map(c => ({ ...c, _raw: true as const })),
        events: schedulerData.events,
        schedulerState: {
          lastTokShowDay: schedulerData.lastTokShowDay,
          lastVotingDay: schedulerData.lastVotingDay,
        },
        votingSessions: this.votingEngine.toJSON(),
        gossipItems: exportGossipItems(),
      },
      simulationMeta: {
        lastReflectionTick: this.lastReflectionTick,
        reflectionRotation: this.reflectionRotation,
        lastPlanDay: this.lastPlanDay,
        recentAlerts: [...this.recentAlerts.entries()],
      },
    }
  }

  onEvent(handler: SimulationEventHandler) {
    this.eventHandlers.push(handler)
  }

  emit(event: SSEEvent) {
    for (const handler of this.eventHandlers) {
      handler(event)
    }
  }

  start(tickIntervalMs = TICK_INTERVAL_MS) {
    if (this.state.isRunning) return
    this.state.isRunning = true
    this.baseTickIntervalMs = tickIntervalMs
    const interval = this._isPaused ? tickIntervalMs : tickIntervalMs / this.speedMultiplier
    console.log(`[Simulation] Started. Tick every ${interval}ms`)
    this.tickInterval = setInterval(() => this.tick(), interval)
  }

  stop() {
    this.state.isRunning = false
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
    console.log('[Simulation] Stopped')
  }

  // --- Speed controls ---

  setSpeed(multiplier: number) {
    if (multiplier === 0) {
      this.pause()
      return
    }
    this.speedMultiplier = multiplier
    this._isPaused = false
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      const interval = this.baseTickIntervalMs / this.speedMultiplier
      this.tickInterval = setInterval(() => this.tick(), interval)
      console.log(`[Simulation] Speed set to ${multiplier}x (tick every ${interval}ms)`)
    }
  }

  pause() {
    this._isPaused = true
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
    console.log('[Simulation] Paused')
  }

  resume() {
    if (!this._isPaused) return
    this._isPaused = false
    const interval = this.baseTickIntervalMs / this.speedMultiplier
    this.tickInterval = setInterval(() => this.tick(), interval)
    console.log('[Simulation] Resumed')
  }

  isPaused(): boolean {
    return this._isPaused
  }

  getSpeed(): number {
    return this._isPaused ? 0 : this.speedMultiplier
  }

  async tick() {
    if (this._isPaused) return
    try {
      await this.processTick()
    } catch (error) {
      console.error('[Simulation] Tick error:', error)
    }
  }

  /** Apply a host twist to the simulation */
  applyTwist(type: string, data: Record<string, unknown>) {
    const tick = this.state.clock.tick

    switch (type) {
      case 'immunity': {
        const agentId = data.agentId as string
        const agent = this.state.agents.find(a => a.id === agentId)
        if (agent) {
          agent.hasImmunity = true
          this.emit({
            type: 'drama_alert',
            data: { message: `[ВЕДУЩИЙ] ${agent.bio.name} получает иммунитет от выселения!` },
            tick,
          })
        }
        break
      }
      case 'secret_reveal': {
        const message = data.message as string
        this.emit({
          type: 'drama_alert',
          data: { message: `[СЕКРЕТ] ${message}` },
          tick,
        })
        break
      }
      case 'forced_nomination': {
        const agentId = data.agentId as string
        const agent = this.state.agents.find(a => a.id === agentId)
        if (agent) {
          this.emit({
            type: 'drama_alert',
            data: { message: `[ВЕДУЩИЙ] ${agent.bio.name} автоматически номинирован(а)!` },
            tick,
          })
        }
        break
      }
      case 'return_all': {
        const returned: string[] = []
        for (const agent of this.state.agents) {
          if (!agent.isEvicted) continue
          agent.isEvicted = false
          agent.evictedOnDay = null
          agent.status = 'free'
          agent.location = 'yard'
          agent.position = getLocationPosition('yard', this.state.agents.indexOf(agent))
          returned.push(agent.bio.name)
          this.emit({
            type: 'agent_move',
            data: { agentId: agent.id, name: agent.bio.name, location: 'yard', position: agent.position },
            tick,
          })
        }
        if (returned.length > 0) {
          this.emit({
            type: 'drama_alert',
            data: { message: `[ВЕДУЩИЙ] Все участники возвращаются! ${returned.join(', ')} снова в проекте!` },
            tick,
          })
        }
        break
      }
    }
  }

  /** Generate catch-up summary for newly connected client */
  getCatchUpData() {
    const activeAgents = this.state.agents.filter(a => !a.isEvicted)
    const evictedAgents = this.state.agents.filter(a => a.isEvicted)

    // Relationship highlights (strongest positive and negative)
    const rels = this.relationshipGraph.getAll()
    const topFriends = [...rels].sort((a, b) => b.friendship - a.friendship).slice(0, 3)
    const topRivals = [...rels].sort((a, b) => b.rivalry - a.rivalry).slice(0, 3)
    const topRomance = [...rels].sort((a, b) => b.romance - a.romance).slice(0, 3)

    const getName = (id: string) => this.state.agents.find(a => a.id === id)?.bio.name ?? '?'

    return {
      clock: this.state.clock,
      activeAgentCount: activeAgents.length,
      evictions: evictedAgents.map(a => ({ name: a.bio.name, day: a.evictedOnDay })),
      episode: this.currentEpisode,
      drama: this.state.drama,
      relationshipHighlights: {
        friends: topFriends.map(r => ({ a: getName(r.agentAId), b: getName(r.agentBId), score: r.friendship })),
        rivals: topRivals.filter(r => r.rivalry > 20).map(r => ({ a: getName(r.agentAId), b: getName(r.agentBId), score: r.rivalry })),
        romances: topRomance.filter(r => r.romance > 20).map(r => ({ a: getName(r.agentAId), b: getName(r.agentBId), score: r.romance })),
      },
      speed: this.getSpeed(),
      isPaused: this._isPaused,
    }
  }

  async processTick() {
    const { state } = this

    // Budget tracker tick start
    budgetTracker.startTick()

    // 1. Advance clock
    state.clock = advanceClock(state.clock)
    const tick = state.clock.tick

    // Episode tracking
    const activeAgents = state.agents.filter(a => !a.isEvicted)
    const prevEpisode = this.currentEpisode
    this.currentEpisode = calculateEpisode(state.clock, activeAgents.length)

    if (prevEpisode && prevEpisode.episodeNumber !== this.currentEpisode.episodeNumber) {
      this.emit({
        type: 'episode_change',
        data: { episode: this.currentEpisode },
        tick,
      })
    }

    // Finale check
    if (this.currentEpisode.isFinale && !this.finaleEmitted && activeAgents.length <= 2) {
      const winnerId = determineWinner(
        activeAgents.map(a => a.id),
        this.relationshipGraph.getAll()
      )
      const winner = this.state.agents.find(a => a.id === winnerId)
      if (winner) {
        this.finaleEmitted = true
        this.emit({
          type: 'finale',
          data: {
            winnerId: winner.id,
            winnerName: winner.bio.name,
            episode: this.currentEpisode,
          },
          tick,
        })
      }
    }

    // 2. Decay needs
    state.agents = state.agents.map(agent => {
      if (agent.isEvicted || agent.status === 'sleeping') return agent
      return { ...agent, needs: decayNeeds(agent) }
    })

    // 3. Decay emotions
    state.agents = state.agents.map(agent => {
      if (agent.isEvicted) return agent
      return { ...agent, emotions: decayEmotions(agent.emotions) }
    })

    // 3b. Emotional contagion — agents in same room spread emotions
    const agentsByLocation = new Map<LocationId, Agent[]>()
    for (const agent of state.agents) {
      if (agent.isEvicted) continue
      const loc = agent.location
      if (!agentsByLocation.has(loc)) agentsByLocation.set(loc, [])
      agentsByLocation.get(loc)!.push(agent)
    }
    for (const [, group] of agentsByLocation) {
      if (group.length < 2) continue
      for (const agent of group) {
        const oldMood = agent.emotions.currentMood
        agent.emotions = applyEmotionalContagion(agent, group)
        if (agent.emotions.currentMood !== oldMood) {
          console.log(`[Contagion] ${agent.bio.name} caught mood ${agent.emotions.currentMood} from nearby agents`)
        }
      }
    }

    // 3c. Clear vulnerability flags (decay after 5 ticks)
    for (const agent of state.agents) {
      if (agent.activeVulnerability && Math.random() < 0.2) {
        agent.activeVulnerability = undefined
      }
    }

    // 4. Update energy
    state.agents = state.agents.map(agent => {
      if (agent.isEvicted) return agent
      const energy = agent.status === 'sleeping'
        ? recoverEnergy(agent)
        : decayEnergy(agent)
      return { ...agent, energy }
    })

    // 5. Process scheduled events
    const newEvents = this.eventScheduler.processTick(state.clock, state.agents)
    for (const event of newEvents) {
      this.handleEventStart(event)
    }

    // 6. Handle sleeping — assign each agent to a specific bed position
    if (isNightTime(state.clock)) {
      // Bed positions in OLD server coordinate space (bedroom: x:0, y:90, w:100, h:100)
      const bedPositions = [
        { x: 15, y: 110 },  // bed 1 (top-left)
        { x: 15, y: 165 },  // bed 2 (bottom-left)
        { x: 75, y: 110 },  // bed 3 (top-right)
        { x: 75, y: 165 },  // bed 4 (bottom-right)
        { x: 35, y: 110 },
        { x: 35, y: 165 },
        { x: 55, y: 110 },
        { x: 55, y: 165 },
      ]
      let bedIdx = 0
      state.agents = state.agents.map(agent => {
        if (agent.isEvicted) return agent
        const bed = bedPositions[bedIdx % bedPositions.length]
        bedIdx++
        const wasNotSleeping = agent.status !== 'sleeping' || agent.location !== 'bedroom'
        const updated = { ...agent, status: 'sleeping' as const, location: 'bedroom' as LocationId, position: bed }
        // Emit move event so client animates the transition
        if (wasNotSleeping) {
          this.emit({
            type: 'agent_move',
            data: { agentId: agent.id, name: agent.bio.name, location: 'bedroom', position: bed },
            tick,
          })
        }
        return updated
      })
    } else {
      // Wake up — move to living room
      state.agents = state.agents.map(agent => {
        if (agent.isEvicted) return agent
        if (agent.status === 'sleeping') {
          const wakeLocation: LocationId = 'living_room'
          const pos = randomLocationPosition(wakeLocation)
          this.emit({
            type: 'agent_move',
            data: { agentId: agent.id, name: agent.bio.name, location: wakeLocation, position: pos },
            tick,
          })
          return { ...agent, status: 'free' as const, location: wakeLocation, position: pos }
        }
        return agent
      })
    }

    // 7. Agent decisions (parallel)
    const freeAgents = state.agents.filter(
      a => !a.isEvicted && a.status === 'free' && !isNightTime(state.clock)
    )

    const decisions = await Promise.all(
      freeAgents.map(agent =>
        makeDecision(agent, state.agents, state.clock, this.memoryStore, this.relationshipGraph, this.useLLM)
      )
    )

    // 8. Execute decisions
    for (const decision of decisions) {
      await this.executeDecision(decision)
    }

    // 8b. Idle wandering — free agents occasionally shift within their room
    if (tick % WANDER_TICK_INTERVAL === 0) {
      for (const agent of state.agents) {
        if (agent.isEvicted || agent.status !== 'free') continue
        if (Math.random() > IDLE_WANDER_CHANCE) continue

        if (Math.random() < BATHROOM_CHANCE && agent.location !== 'bathroom') {
          agent.location = 'bathroom'
          agent.position = randomLocationPosition('bathroom')
          this.emit({
            type: 'agent_move',
            data: { agentId: agent.id, name: agent.bio.name, location: 'bathroom', position: agent.position },
            tick,
          })
          continue
        }
        // If in bathroom, leave after one cycle
        if (agent.location === 'bathroom') {
          const dest: LocationId = ['yard', 'living_room', 'kitchen'][Math.floor(Math.random() * 3)] as LocationId
          agent.location = dest
          agent.position = randomLocationPosition(dest)
          this.emit({
            type: 'agent_move',
            data: { agentId: agent.id, name: agent.bio.name, location: dest, position: agent.position },
            tick,
          })
          continue
        }

        const oldPos = { ...agent.position }
        agent.position = randomLocationPosition(agent.location)
        if (Math.abs(oldPos.x - agent.position.x) > 5 || Math.abs(oldPos.y - agent.position.y) > 5) {
          this.emit({
            type: 'agent_move',
            data: { agentId: agent.id, name: agent.bio.name, location: agent.location, position: agent.position },
            tick,
          })
        }
      }
    }

    // 9. Progress active conversations
    const activeConvs = this.conversationEngine.getActiveConversations()
    for (const conv of activeConvs) {
      const msg = await this.conversationEngine.progressConversation(
        conv, state.agents, tick, this.memoryStore, this.relationshipGraph, this.useLLM, state.clock
      )
      if (msg) {
        const speaker = state.agents.find(a => a.id === msg.agentId)
        this.emit({
          type: 'conversation',
          data: {
            conversationId: conv.id,
            speakerName: speaker?.bio.name,
            speakerId: msg.agentId,
            content: msg.content,
            emotion: msg.emotion,
            action: msg.action,
            location: conv.location,
          },
          tick,
        })
      }
    }

    // End conversations where agents left or are busy
    for (const conv of activeConvs) {
      const participantsAvailable = conv.participants.every(id => {
        const agent = state.agents.find(a => a.id === id)
        return agent && !agent.isEvicted && agent.status !== 'sleeping'
      })
      // Also end conversations where participants are no longer in the same location
      const sameLocation = conv.participants.length >= 2 && (() => {
        const locs = conv.participants.map(id => state.agents.find(a => a.id === id)?.location)
        return locs.every(l => l && l === locs[0])
      })()
      if (!participantsAvailable || !sameLocation) {
        this.conversationEngine.endConversation(conv.id, tick)
        // Free all participants
        for (const pid of conv.participants) {
          const agent = state.agents.find(a => a.id === pid)
          if (agent && agent.status === 'in_conversation') {
            agent.status = 'free'
          }
        }
      }
    }

    // Also free agents whose conversation already ended (reached max turns, boring, etc.)
    for (const conv of activeConvs) {
      if (conv.endedAtTick !== null) {
        for (const pid of conv.participants) {
          const agent = state.agents.find(a => a.id === pid)
          if (agent && agent.status === 'in_conversation') {
            agent.status = 'free'
          }
        }
      }
    }

    // 10. Drama detection + amplification
    const allConvs = this.conversationEngine.getAllConversations()
    state.drama = detectDrama(state.agents, this.relationshipGraph, allConvs, state.drama)
    state.agents = amplifyDrama(state.agents, state.drama, this.relationshipGraph)

    // Drama alerts (deduplicated — same alert not more than once per 30 ticks)
    const alerts = getDramaAlerts(state.agents, this.relationshipGraph)
    for (const alert of alerts) {
      const lastSent = this.recentAlerts.get(alert) ?? 0
      if (tick - lastSent >= ALERT_DEDUP_WINDOW) {
        this.emit({ type: 'drama_alert', data: { message: alert }, tick })
        this.recentAlerts.set(alert, tick)
      }
    }
    // Clean old entries
    if (tick % ALERT_CLEANUP_INTERVAL === 0) {
      for (const [key, t] of this.recentAlerts) {
        if (tick - t > ALERT_CLEANUP_INTERVAL) this.recentAlerts.delete(key)
      }
    }

    // 10b. Reflections — every 30 ticks, 1-2 agents synthesize insights
    if (tick - this.lastReflectionTick >= REFLECTION_INTERVAL && this.useLLM) {
      this.lastReflectionTick = tick
      const aliveAgents = state.agents.filter(a => !a.isEvicted)
      const count = Math.min(MAX_REFLECTIONS_PER_TICK, aliveAgents.length)
      for (let i = 0; i < count; i++) {
        const agentIdx = (this.reflectionRotation + i) % aliveAgents.length
        const agent = aliveAgents[agentIdx]
        // Run async without blocking tick
        generateReflection(agent, this.memoryStore, tick - REFLECTION_INTERVAL, state.agents, tick)
          .catch(err => console.warn(`[Reflection] Error for ${agent.bio.name}:`, err))
      }
      this.reflectionRotation = (this.reflectionRotation + count) % Math.max(1, aliveAgents.length)
    }

    // 10c. Day planning — at 08:00 each day
    if (state.clock.hour === 8 && state.clock.minute === 0 && state.clock.day > this.lastPlanDay && this.useLLM) {
      this.lastPlanDay = state.clock.day
      for (const agent of state.agents) {
        if (agent.isEvicted) continue
        generateDayPlan(agent, state.agents, this.memoryStore, this.relationshipGraph, state.clock)
          .then(plan => { agent.currentPlan = plan })
          .catch(err => console.warn(`[Planner] Error for ${agent.bio.name}:`, err))
      }
    }

    // Drama-triggered events
    const shouldTrigger = shouldTriggerEvent(state.drama)
    if (shouldTrigger.shouldTrigger && shouldTrigger.type === 'confessional') {
      // Already handled by scheduler at 23:00
    }

    // 11. Update state for SSE
    state.relationships = this.relationshipGraph.getAll()
    state.conversations = this.conversationEngine.getAllConversations()
    state.activeEvents = this.eventScheduler.getActiveEvents()

    // Broadcast state delta
    this.emit({
      type: 'state_update',
      data: {
        clock: state.clock,
        agents: state.agents.map(a => ({
          id: a.id,
          name: a.bio.name,
          location: a.location,
          status: a.status,
          mood: a.emotions.currentMood,
          energy: Math.round(a.energy),
          position: a.position,
        })),
        drama: state.drama,
        activeEvents: state.activeEvents.map(e => ({
          id: e.id,
          type: e.type,
          location: e.location,
        })),
        episode: this.currentEpisode,
        speed: this.getSpeed(),
        isPaused: this._isPaused,
      },
      tick,
    })

    // Log
    if (tick % 6 === 0) {
      console.log(
        `[${formatGameTime(state.clock)}] Drama: ${state.drama.overall} | ` +
        `Active convs: ${activeConvs.length} | ` +
        `Agents: ${state.agents.filter(a => !a.isEvicted).length}` +
        (this.currentEpisode ? ` | Ep.${this.currentEpisode.episodeNumber} Day${this.currentEpisode.dayWithinEpisode}` : '')
      )
    }

    // Budget stats logging
    if (tick % BUDGET_LOG_INTERVAL === 0) {
      budgetTracker.logStats()
    }

    // Auto-save
    if (tick % AUTO_SAVE_INTERVAL === 0) {
      try {
        const save = this.saveState()
        saveSimulation(save)
      } catch (err) {
        console.error('[Persistence] Auto-save failed:', err)
      }
    }
  }

  private async executeDecision(decision: import('./types').AgentDecision) {
    const agent = this.state.agents.find(a => a.id === decision.agentId)
    if (!agent) return

    const tick = this.state.clock.tick

    switch (decision.action) {
      case 'move': {
        if (decision.targetLocation) {
          agent.location = decision.targetLocation
          agent.position = getLocationPosition(decision.targetLocation, this.state.agents.indexOf(agent))
          this.emit({
            type: 'agent_move',
            data: { agentId: agent.id, name: agent.bio.name, location: agent.location, position: agent.position },
            tick,
          })
        }
        break
      }

      case 'talk':
      case 'flirt':
      case 'argue':
      case 'gossip':
      case 'comfort':
      case 'manipulate':
      case 'confront':
      case 'apologize':
      case 'form_alliance':
      case 'break_alliance': {
        if (!decision.targetAgentId) break
        const target = this.state.agents.find(a => a.id === decision.targetAgentId)
        if (!target || target.isEvicted || target.status === 'sleeping') break

        // Move to target's location if needed
        if (agent.location !== target.location) {
          agent.location = target.location
          agent.position = getLocationPosition(target.location, this.state.agents.indexOf(agent))
          this.emit({
            type: 'agent_move',
            data: { agentId: agent.id, name: agent.bio.name, location: agent.location, position: agent.position },
            tick,
          })
        }

        // Apply relationship changes
        const result = applyInteraction(
          this.relationshipGraph, agent, target, decision.action, tick, decision.reasoning
        )

        // Apply emotional impact (relationship-aware)
        const rel = this.relationshipGraph.get(agent.id, target.id)
        agent.emotions = applyEmotionalImpact(agent.emotions, getEmotionalImpact(decision.action, 'actor', rel))
        target.emotions = applyEmotionalImpact(target.emotions, getEmotionalImpact(decision.action, 'target', rel))

        // Satisfy needs
        agent.needs = satisfyNeed(agent.needs, 'socialNeed', 15)
        if (decision.action === 'flirt') {
          agent.needs = satisfyNeed(agent.needs, 'intimacyNeed', 20)
        }
        if (decision.action === 'confront' || decision.action === 'argue') {
          agent.needs = satisfyNeed(agent.needs, 'dominanceNeed', 20)
        }

        // Start or join conversation for talk-like actions
        if (['talk', 'flirt', 'gossip', 'comfort', 'argue', 'confront'].includes(decision.action)) {
          const existingConv = this.conversationEngine.getAgentConversation(agent.id)
          if (!existingConv) {
            // Check if target is already in a conversation we can join (group conversation)
            const targetConv = this.conversationEngine.getAgentConversation(target.id)
            if (targetConv && targetConv.participants.length < 4 && !targetConv.isPrivate) {
              // Join existing conversation
              targetConv.participants.push(agent.id)
              agent.status = 'in_conversation'
              console.log(`[GroupConv] ${agent.bio.name} joined conversation with ${targetConv.participants.length} participants`)
            } else if (!targetConv) {
              agent.status = 'in_conversation'
              target.status = 'in_conversation'
              this.conversationEngine.startConversation(agent, target, tick, decision.reasoning)
            }
          }
        }

        // Check jealousy for observers
        if (decision.action === 'flirt') {
          const observers = this.state.agents.filter(
            a => a.location === agent.location && a.id !== agent.id && a.id !== target.id && !a.isEvicted
          )
          for (const observer of observers) {
            const jealousy = checkJealousyTrigger(observer, agent.id, target.id, this.relationshipGraph)
            if (jealousy?.triggered) {
              observer.emotions = applyEmotionalImpact(observer.emotions, {
                jealousy: jealousy.intensity,
                anger: jealousy.intensity * 0.5,
              })
              this.memoryStore.addMemory(
                observer.id, tick, 'observation',
                `Видел(а) как ${agent.bio.name} флиртует с ${target.bio.name}`,
                calculateImportance('romantic', { emotionalIntensity: jealousy.intensity }),
                [agent.id, target.id], agent.location
              )
              observer.gossipUrge = Math.min(100, observer.gossipUrge + 30)
            }
          }
        }

        // Memory
        this.memoryStore.addMemory(
          agent.id, tick, 'decision',
          `${decision.action} → ${target.bio.name}: ${decision.reasoning}`,
          calculateImportance(
            decision.action === 'argue' ? 'argument' :
            decision.action === 'flirt' ? 'romantic' :
            decision.action === 'manipulate' ? 'betrayal' : 'casual_chat'
          ),
          [target.id], agent.location
        )

        break
      }

      case 'rest': {
        if (decision.targetLocation && decision.targetLocation !== agent.location) {
          agent.location = decision.targetLocation
          agent.position = getLocationPosition(decision.targetLocation, this.state.agents.indexOf(agent))
          this.emit({
            type: 'agent_move',
            data: { agentId: agent.id, name: agent.bio.name, location: agent.location, position: agent.position },
            tick,
          })
        }
        agent.status = 'free'
        agent.energy = Math.min(100, agent.energy + 3)
        break
      }

      case 'think':
      case 'cry':
      case 'celebrate': {
        // Solo actions
        this.memoryStore.addMemory(
          agent.id, tick, 'emotion',
          `${decision.action}: ${decision.reasoning}`,
          2, [], agent.location
        )
        break
      }

      case 'avoid': {
        // Move to a different location
        const currentLoc = agent.location
        const otherLocations: LocationId[] = ['yard', 'bedroom', 'living_room', 'kitchen', 'bathroom']
          .filter(l => l !== currentLoc) as LocationId[]
        agent.location = otherLocations[Math.floor(Math.random() * otherLocations.length)]
        agent.position = getLocationPosition(agent.location, this.state.agents.indexOf(agent))
        this.emit({
          type: 'agent_move',
          data: { agentId: agent.id, name: agent.bio.name, location: agent.location, position: agent.position },
          tick,
        })
        break
      }
    }
  }

  private handleEventStart(event: GameEvent) {
    const tick = this.state.clock.tick
    console.log(`[Event] ${event.type} started at tick ${tick}`)

    switch (event.type) {
      case 'tok_show':
        // Run tok show asynchronously
        runTokShow(
          event, this.state.agents, this.relationshipGraph, this.memoryStore, this.useLLM
        ).then(result => {
          this.emit({
            type: 'event_start',
            data: {
              eventType: 'tok_show',
              topic: result.topic,
              statements: result.statements,
            },
            tick,
          })
        }).catch(err => console.error('Tok show error:', err))
        break

      case 'voting': {
        const session = this.votingEngine.startVoting(
          this.state.clock.day, this.state.agents, this.relationshipGraph
        )
        this.votingEngine.castAgentVotes(session, this.state.agents, this.relationshipGraph)
        this.emit({
          type: 'event_start',
          data: {
            eventType: 'voting',
            sessionId: session.id,
            nominees: session.nominees.map(id => {
              const a = this.state.agents.find(ag => ag.id === id)
              return { id, name: a?.bio.name }
            }),
          },
          tick,
        })

        // Emit periodic vote updates
        const voteUpdateInterval = setInterval(() => {
          const activeSession = this.votingEngine.getActiveSession()
          if (!activeSession) {
            clearInterval(voteUpdateInterval)
            return
          }
          this.emit({
            type: 'vote_update',
            data: {
              sessionId: activeSession.id,
              totalVotes: Object.keys(activeSession.votes).length + Object.keys(activeSession.userVotes).length,
            },
            tick: this.state.clock.tick,
          })
        }, 3000)

        // Auto-tally after delay (in real app, wait for user votes)
        setTimeout(() => {
          clearInterval(voteUpdateInterval)
          const evictedId = this.votingEngine.tallyVotes(session.id)
          if (evictedId) {
            const evicted = this.state.agents.find(a => a.id === evictedId)
            if (evicted) {
              // Check immunity
              if (evicted.hasImmunity) {
                evicted.hasImmunity = false
                this.emit({
                  type: 'drama_alert',
                  data: { message: `${evicted.bio.name} использует иммунитет и остаётся в проекте!` },
                  tick: this.state.clock.tick,
                })
                return
              }
              evicted.isEvicted = true
              evicted.evictedOnDay = this.state.clock.day
              this.emit({
                type: 'eviction',
                data: { agentId: evictedId, name: evicted.bio.name, day: this.state.clock.day },
                tick: this.state.clock.tick,
              })
              console.log(`[Eviction] ${evicted.bio.name} выселен(а) на день ${this.state.clock.day}`)
            }
          }
        }, 15000) // 15 sec for user voting
        break
      }

      case 'confessional':
        // Handled by conversation engine with special prompt
        break

      case 'breakfast':
      case 'lunch':
      case 'dinner':
        // End any active conversations first, then move agents to kitchen
        for (const conv of this.conversationEngine.getActiveConversations()) {
          this.conversationEngine.endConversation(conv.id, tick)
          // Free conversation participants
          for (const pid of conv.participants) {
            const p = this.state.agents.find(a => a.id === pid)
            if (p) p.status = 'free'
          }
        }
        for (const agent of this.state.agents) {
          if (!agent.isEvicted && agent.status !== 'sleeping') {
            agent.status = 'free'
            agent.location = 'kitchen'
            agent.position = getLocationPosition('kitchen', this.state.agents.indexOf(agent))
            this.emit({
              type: 'agent_move',
              data: { agentId: agent.id, name: agent.bio.name, location: 'kitchen', position: agent.position },
              tick,
            })
          }
        }
        this.emit({
          type: 'event_start',
          data: { eventType: event.type },
          tick,
        })
        break
    }
  }

  // --- Public API ---

  getAgent(id: string): Agent | undefined {
    return this.state.agents.find(a => a.id === id)
  }

  getAgentByName(name: string): Agent | undefined {
    return this.state.agents.find(a => a.bio.name === name)
  }

  getRelationships(agentId: string) {
    return this.relationshipGraph.getForAgent(agentId)
  }

  getMemories(agentId: string) {
    return this.memoryStore.getRecentMemories(agentId, 20)
  }

  addUserVote(sessionId: string, visitorId: string, nomineeId: string) {
    return this.votingEngine.addUserVote(sessionId, visitorId, nomineeId)
  }

  getVotingSession() {
    return this.votingEngine.getActiveSession()
  }

  getEpisode(): EpisodeInfo | null {
    return this.currentEpisode
  }
}

/** Generate a spread-out position within a room (OLD server coordinate space).
 *  Index-based for deterministic placement, with padding to avoid walls. */
function getLocationPosition(location: LocationId, index: number): { x: number; y: number } {
  const bounds = OLD_ROOM_BOUNDS[location]
  if (!bounds) return { x: 160, y: 130 }

  // Spread agents in a grid pattern within the room's walkable interior
  const margin = 12
  const innerW = bounds.w - margin * 2
  const innerH = bounds.h - margin * 2
  const cols = Math.max(2, Math.ceil(Math.sqrt(8))) // 3 columns for up to 8 agents
  const rows = Math.max(2, Math.ceil(8 / cols))
  const col = index % cols
  const row = Math.floor(index / cols) % rows

  return {
    x: Math.round(bounds.x + margin + (col + 0.5) * (innerW / cols)),
    y: Math.round(bounds.y + margin + (row + 0.5) * (innerH / rows)),
  }
}

/** Generate a random position within a room (OLD server coordinate space) */
function randomLocationPosition(location: LocationId): { x: number; y: number } {
  const bounds = OLD_ROOM_BOUNDS[location]
  if (!bounds) return { x: 160, y: 130 }

  const margin = 15
  return {
    x: Math.round(bounds.x + margin + Math.random() * (bounds.w - margin * 2)),
    y: Math.round(bounds.y + margin + Math.random() * (bounds.h - margin * 2)),
  }
}

function getEmotionalImpact(
  action: string,
  role: 'actor' | 'target',
  relationship?: Relationship | null,
): Partial<{ happiness: number; anger: number; sadness: number; excitement: number; love: number; jealousy: number; fear: number }> {
  let base: Partial<{ happiness: number; anger: number; sadness: number; excitement: number; love: number; jealousy: number; fear: number }>

  if (role === 'actor') {
    switch (action) {
      case 'flirt': base = { excitement: 10, love: 5, happiness: 5 }; break
      case 'argue': base = { anger: 8, excitement: 5 }; break
      case 'comfort': base = { happiness: 5 }; break
      case 'confront': base = { anger: 6, excitement: 3 }; break
      case 'manipulate': base = { excitement: 5 }; break
      case 'apologize': base = { sadness: 5 }; break
      default: base = { happiness: 3 }
    }
  } else {
    switch (action) {
      case 'flirt': base = { excitement: 8, love: 3, happiness: 5 }; break
      case 'argue': base = { anger: 10, sadness: 3 }; break
      case 'comfort': base = { happiness: 15, sadness: -10 }; break
      case 'confront': base = { anger: 8, sadness: 5 }; break
      case 'manipulate': base = { happiness: 3 }; break // doesn't know they're being manipulated
      case 'apologize': base = { happiness: 10, anger: -10 }; break
      default: base = { happiness: 2 }
    }
  }

  // Relationship-aware multipliers (only for target)
  if (role === 'target' && relationship) {
    const result = { ...base }

    // Flirt from someone you love → amplified
    if (action === 'flirt' && relationship.romance > 50) {
      if (result.excitement) result.excitement = Math.round(result.excitement * 2)
      if (result.love) result.love = Math.round(result.love * 2)
    }

    // Comfort from rival → reduced + fear
    if (action === 'comfort' && relationship.rivalry > 50) {
      if (result.happiness) result.happiness = Math.round(result.happiness * 0.3)
      result.fear = (result.fear ?? 0) + 5
    }

    // Confront from ally → betrayal hurt amplified
    if ((action === 'confront' || action === 'argue') && relationship.alliance) {
      if (result.anger) result.anger = Math.round(result.anger * 2)
      if (result.sadness) result.sadness = Math.round((result.sadness ?? 0) * 2 + 10)
    }

    // Manipulate when trust is very low → target sees through it
    if (action === 'manipulate' && relationship.trust < -30) {
      result.happiness = 0
      result.anger = (result.anger ?? 0) + 10
    }

    return result
  }

  return base
}
