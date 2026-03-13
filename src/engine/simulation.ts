import {
  Agent, SimulationState, SSEEvent, LocationId, GameEvent,
} from './types'
import { createClock, advanceClock, isNightTime, formatGameTime } from './clock'
import { createStartingCast } from './agents/presets'
import {
  decayNeeds, decayEmotions, decayEnergy, recoverEnergy,
  satisfyNeed, applyEmotionalImpact,
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

  constructor(useLLM = true) {
    this.useLLM = useLLM
    this.memoryStore = new MemoryStore()
    this.relationshipGraph = new RelationshipGraph()
    this.conversationEngine = new ConversationEngine()
    this.eventScheduler = new EventScheduler()
    this.votingEngine = new VotingEngine()

    const agents = createStartingCast()
    // Scatter agents across locations
    const locations: LocationId[] = ['yard', 'bedroom', 'living_room', 'kitchen', 'living_room', 'kitchen', 'yard', 'living_room']
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

  onEvent(handler: SimulationEventHandler) {
    this.eventHandlers.push(handler)
  }

  private emit(event: SSEEvent) {
    for (const handler of this.eventHandlers) {
      handler(event)
    }
  }

  start(tickIntervalMs = 5000) {
    if (this.state.isRunning) return
    this.state.isRunning = true
    console.log(`[Simulation] Started. Tick every ${tickIntervalMs}ms`)
    this.tickInterval = setInterval(() => this.tick(), tickIntervalMs)
  }

  stop() {
    this.state.isRunning = false
    if (this.tickInterval) {
      clearInterval(this.tickInterval)
      this.tickInterval = null
    }
    console.log('[Simulation] Stopped')
  }

  async tick() {
    try {
      await this.processTick()
    } catch (error) {
      console.error('[Simulation] Tick error:', error)
    }
  }

  async processTick() {
    const { state } = this

    // 1. Advance clock
    state.clock = advanceClock(state.clock)
    const tick = state.clock.tick

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
      // Client will remap these to canvas coordinates
      const bedPositions = [
        { x: 15, y: 110 },  // bed 1 (top-left)
        { x: 15, y: 165 },  // bed 2 (bottom-left)
        { x: 75, y: 110 },  // bed 3 (top-right)
        { x: 75, y: 165 },  // bed 4 (bottom-right)
        { x: 35, y: 110 },  // overflow positions
        { x: 35, y: 165 },
        { x: 55, y: 110 },
        { x: 55, y: 165 },
      ]
      let bedIdx = 0
      state.agents = state.agents.map(agent => {
        if (agent.isEvicted) return agent
        const bed = bedPositions[bedIdx % bedPositions.length]
        bedIdx++
        return { ...agent, status: 'sleeping', location: 'bedroom', position: bed }
      })
    } else {
      // Wake up
      state.agents = state.agents.map(agent => {
        if (agent.isEvicted) return agent
        if (agent.status === 'sleeping' && !isNightTime(state.clock)) {
          return { ...agent, status: 'free' }
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
    if (tick % 3 === 0) { // every 3 ticks (~30 game minutes)
      for (const agent of state.agents) {
        if (agent.isEvicted || agent.status !== 'free') continue
        if (Math.random() > 0.4) continue // 40% chance per eligible tick
        const oldPos = { ...agent.position }
        agent.position = getLocationPosition(agent.location, Math.floor(Math.random() * 8))
        // Only emit if position actually changed significantly
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
        conv, state.agents, tick, this.memoryStore, this.relationshipGraph, this.useLLM
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
      if (tick - lastSent >= 30) {
        this.emit({ type: 'drama_alert', data: { message: alert }, tick })
        this.recentAlerts.set(alert, tick)
      }
    }
    // Clean old entries
    if (tick % 60 === 0) {
      for (const [key, t] of this.recentAlerts) {
        if (tick - t > 60) this.recentAlerts.delete(key)
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
      },
      tick,
    })

    // Log
    if (tick % 6 === 0) {
      console.log(
        `[${formatGameTime(state.clock)}] Drama: ${state.drama.overall} | ` +
        `Active convs: ${activeConvs.length} | ` +
        `Agents: ${state.agents.filter(a => !a.isEvicted).length}`
      )
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
        if (!target || target.isEvicted) break

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

        // Apply emotional impact
        agent.emotions = applyEmotionalImpact(agent.emotions, getEmotionalImpact(decision.action, 'actor'))
        target.emotions = applyEmotionalImpact(target.emotions, getEmotionalImpact(decision.action, 'target'))

        // Satisfy needs
        agent.needs = satisfyNeed(agent.needs, 'socialNeed', 15)
        if (decision.action === 'flirt') {
          agent.needs = satisfyNeed(agent.needs, 'intimacyNeed', 20)
        }
        if (decision.action === 'confront' || decision.action === 'argue') {
          agent.needs = satisfyNeed(agent.needs, 'dominanceNeed', 20)
        }

        // Start or continue conversation for talk-like actions
        if (['talk', 'flirt', 'gossip', 'comfort', 'argue', 'confront'].includes(decision.action)) {
          const existingConv = this.conversationEngine.getAgentConversation(agent.id)
          if (!existingConv) {
            agent.status = 'in_conversation'
            target.status = 'in_conversation'
            this.conversationEngine.startConversation(agent, target, tick, decision.reasoning)
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
        if (decision.targetLocation) {
          agent.location = decision.targetLocation
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
        const otherLocations: LocationId[] = ['yard', 'bedroom', 'living_room', 'kitchen']
          .filter(l => l !== currentLoc) as LocationId[]
        agent.location = otherLocations[Math.floor(Math.random() * otherLocations.length)]
        agent.position = getLocationPosition(agent.location, this.state.agents.indexOf(agent))
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
        // Auto-tally after delay (in real app, wait for user votes)
        setTimeout(() => {
          const evictedId = this.votingEngine.tallyVotes(session.id)
          if (evictedId) {
            const evicted = this.state.agents.find(a => a.id === evictedId)
            if (evicted) {
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
}

function getLocationPosition(location: LocationId, index: number): { x: number; y: number } {
  const base: Record<LocationId, { x: number; y: number }> = {
    yard: { x: 160, y: 40 },
    bedroom: { x: 40, y: 130 },
    living_room: { x: 160, y: 130 },
    kitchen: { x: 260, y: 130 },
    confessional: { x: 160, y: 200 },
  }
  const b = base[location]
  // Offset within location
  const offset = index * 20
  return { x: b.x + (offset % 60) - 30, y: b.y + Math.floor(offset / 60) * 20 }
}

function getEmotionalImpact(
  action: string,
  role: 'actor' | 'target'
): Partial<{ happiness: number; anger: number; sadness: number; excitement: number; love: number; jealousy: number }> {
  if (role === 'actor') {
    switch (action) {
      case 'flirt': return { excitement: 10, love: 5, happiness: 5 }
      case 'argue': return { anger: 8, excitement: 5 }
      case 'comfort': return { happiness: 5 }
      case 'confront': return { anger: 6, excitement: 3 }
      case 'manipulate': return { excitement: 5 }
      case 'apologize': return { sadness: 5 }
      default: return { happiness: 3 }
    }
  } else {
    switch (action) {
      case 'flirt': return { excitement: 8, love: 3, happiness: 5 }
      case 'argue': return { anger: 10, sadness: 3 }
      case 'comfort': return { happiness: 15, sadness: -10 }
      case 'confront': return { anger: 8, sadness: 5 }
      case 'manipulate': return { happiness: 3 } // doesn't know they're being manipulated
      case 'apologize': return { happiness: 10, anger: -10 }
      default: return { happiness: 2 }
    }
  }
}
