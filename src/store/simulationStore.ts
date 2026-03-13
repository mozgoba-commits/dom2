'use client'

import { create } from 'zustand'
import type { Agent, Conversation, DramaScore, GameClock, Mood, LocationId, SSEEvent } from '../engine/types'
import { findPath } from '../engine/pathfinding'
import { useWalkingStore } from './walkingStore'
import { useAnimationStore } from './animationStore'

// Remap server positions to native canvas layout (duplicated from HouseScene to avoid circular deps)
const OLD_LOCS: Record<LocationId, { x: number; y: number; w: number; h: number }> = {
  yard:         { x: 0,   y: 0,   w: 320, h: 90  },
  bedroom:      { x: 0,   y: 90,  w: 100, h: 100 },
  living_room:  { x: 100, y: 90,  w: 120, h: 100 },
  kitchen:      { x: 220, y: 90,  w: 100, h: 100 },
  confessional: { x: 100, y: 190, w: 120, h: 50  },
}
const NEW_LOCS: Record<LocationId, { x: number; y: number; w: number; h: number }> = {
  yard:         { x: 0,   y: 0,   w: 480, h: 130 },
  bedroom:      { x: 0,   y: 133, w: 157, h: 147 },
  living_room:  { x: 160, y: 133, w: 157, h: 147 },
  kitchen:      { x: 320, y: 133, w: 160, h: 147 },
  confessional: { x: 160, y: 283, w: 157, h: 77  },
}
function storeRemapPosition(location: LocationId, pos: { x: number; y: number }) {
  const o = OLD_LOCS[location], n = NEW_LOCS[location]
  if (!o || !n) return pos
  const relX = Math.max(0.12, Math.min(0.88, (pos.x - o.x) / o.w))
  const relY = Math.max(0.18, Math.min(0.82, (pos.y - o.y) / o.h))
  return { x: Math.round(n.x + relX * n.w), y: Math.round(n.y + relY * n.h) }
}

interface AgentSummary {
  id: string
  name: string
  location: LocationId
  status: string
  mood: Mood
  energy: number
  position: { x: number; y: number }
}

interface ActiveEvent {
  id: string
  type: string
  location: LocationId
}

interface ChatMessage {
  id: string
  speakerName: string
  speakerId: string
  content: string
  emotion: Mood
  action?: string
  location: LocationId
  tick: number
  conversationId?: string
  receivedAt: number
}

interface DramaAlert {
  id: string
  message: string
  tick: number
}

interface TokShowData {
  topic: string
  statements: Array<{ agentId: string; name: string; text: string }>
}

interface EvictionData {
  agentId: string
  name: string
  day: number
}

interface ConfessionalData {
  agentId: string
  name: string
  text: string
  emotion?: string
}

interface SimulationStore {
  // State from server
  agents: AgentSummary[]
  clock: GameClock | null
  drama: DramaScore | null
  activeEvents: ActiveEvent[]
  chatMessages: ChatMessage[]
  dramaAlerts: DramaAlert[]
  isConnected: boolean

  // Full agent data (fetched on demand)
  fullAgents: Map<string, Agent>

  // Event overlays
  activeTokShow: TokShowData | null
  activeEviction: EvictionData | null
  activeConfessional: ConfessionalData | null

  // UI state
  selectedAgentId: string | null

  // Actions
  handleSSEEvent: (event: SSEEvent) => void
  setSelectedAgent: (id: string | null) => void
  setConnected: (connected: boolean) => void
  setFullAgent: (agent: Agent) => void
  clearEviction: () => void
  clearConfessional: () => void
}

let msgCounter = 0

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  agents: [],
  clock: null,
  drama: null,
  activeEvents: [],
  chatMessages: [],
  dramaAlerts: [],
  isConnected: false,
  fullAgents: new Map(),
  activeTokShow: null,
  activeEviction: null,
  activeConfessional: null,
  selectedAgentId: null,

  handleSSEEvent: (event: SSEEvent) => {
    switch (event.type) {
      case 'state_update': {
        const data = event.data as {
          clock: GameClock
          agents: AgentSummary[]
          drama: DramaScore
          activeEvents: ActiveEvent[]
        }
        const prevAgents = get().agents
        set({
          clock: data.clock,
          agents: data.agents,
          drama: data.drama,
          activeEvents: data.activeEvents,
        })

        // Initialize ALL agents in animation store + set states from status
        const animStore = useAnimationStore.getState()
        for (const agent of data.agents) {
          const existing = animStore.animations.get(agent.id)

          if (agent.status === 'sleeping') {
            animStore.setAnimationState(agent.id, 'sleeping')
          } else if (agent.status === 'in_conversation') {
            // Only set talking if not already in a more specific anim (arguing, flirting, etc.)
            if (!existing || existing.state === 'idle' || existing.state === 'walking') {
              animStore.setAnimationState(agent.id, 'talking')
            }
          } else if (!existing) {
            // First time seeing this agent — initialize to idle so breathing starts
            animStore.setAnimationState(agent.id, 'idle')
          } else if (existing.state !== 'idle' && existing.state !== 'walking' && agent.status === 'idle') {
            // Agent finished conversation — return to idle, clear facing
            animStore.setAnimationState(agent.id, 'idle')
            animStore.setFacingOverride(agent.id, null)
          }

          // Detect mood changes for reactions
          const prev = prevAgents.find(a => a.id === agent.id)
          if (prev && prev.mood !== agent.mood) {
            if (agent.mood === 'happy' || agent.mood === 'euphoric') {
              animStore.queueReaction(agent.id, { type: 'laughing', duration: 0.8 })
            } else if (agent.mood === 'anxious') {
              animStore.queueReaction(agent.id, { type: 'shocked', duration: 0.5 })
            }
          }
        }

        // Infer facing for in_conversation agents: face toward nearby agents in same location with same status
        const conversing = data.agents.filter(a => a.status === 'in_conversation')
        for (const agent of conversing) {
          const partners = conversing.filter(
            a => a.id !== agent.id && a.location === agent.location
          )
          if (partners.length > 0) {
            const partner = partners[0]
            const aPos = storeRemapPosition(agent.location, agent.position)
            const pPos = storeRemapPosition(partner.location, partner.position)
            const facing = aPos.x > pPos.x ? 'left' : 'right'
            animStore.setFacingOverride(agent.id, facing)
          }
        }
        break
      }

      case 'conversation': {
        const data = event.data as {
          speakerName: string
          speakerId: string
          content: string
          emotion: Mood
          action?: string
          location: LocationId
          conversationId?: string
          targetAgentId?: string
        }
        const msg: ChatMessage = {
          id: `msg-${++msgCounter}`,
          ...data,
          tick: event.tick,
          conversationId: data.conversationId,
          receivedAt: Date.now(),
        }
        set(state => {
          const isDupe = state.chatMessages.some(
            m => m.speakerId === msg.speakerId && m.content === msg.content && m.tick === msg.tick
          )
          if (isDupe) return state
          return { chatMessages: [...state.chatMessages.slice(-100), msg] }
        })

        // Set animation states based on emotion
        const animStore = useAnimationStore.getState()
        let partnerId = data.targetAgentId ?? null

        // If no targetAgentId, infer partner from conversationId or same-location in_conversation agents
        if (!partnerId && data.conversationId) {
          const recentMsgs = get().chatMessages
          const partnerMsg = recentMsgs.find(
            m => m.conversationId === data.conversationId && m.speakerId !== data.speakerId
          )
          if (partnerMsg) partnerId = partnerMsg.speakerId
        }
        if (!partnerId) {
          // Fallback: find another in_conversation agent in the same location
          const agents = get().agents
          const speaker = agents.find(a => a.id === data.speakerId)
          if (speaker) {
            const partner = agents.find(
              a => a.id !== data.speakerId && a.location === speaker.location
                && a.status === 'in_conversation'
            )
            if (partner) partnerId = partner.id
          }
        }

        const emotion = data.emotion
        if (emotion === 'angry' || emotion === 'annoyed') {
          animStore.setAnimationState(data.speakerId, 'arguing', partnerId ?? undefined)
        } else if (emotion === 'flirty') {
          animStore.setAnimationState(data.speakerId, 'flirting', partnerId ?? undefined)
        } else if (emotion === 'sad' || emotion === 'devastated') {
          animStore.setAnimationState(data.speakerId, 'crying', partnerId ?? undefined)
        } else {
          animStore.setAnimationState(data.speakerId, 'talking', partnerId ?? undefined)
        }

        // Face partners toward each other using remapped canvas positions
        if (partnerId) {
          const agents = get().agents
          const speakerAgent = agents.find(a => a.id === data.speakerId)
          const targetAgent = agents.find(a => a.id === partnerId)
          if (speakerAgent && targetAgent) {
            const sPos = storeRemapPosition(speakerAgent.location, speakerAgent.position)
            const tPos = storeRemapPosition(targetAgent.location, targetAgent.position)
            const sFacing: 'left' | 'right' = sPos.x > tPos.x ? 'left' : 'right'
            const tFacing: 'left' | 'right' = sFacing === 'left' ? 'right' : 'left'
            animStore.setFacingOverride(data.speakerId, sFacing)
            animStore.setFacingOverride(partnerId, tFacing)
          }
        }
        break
      }

      case 'drama_alert': {
        const data = event.data as { message: string }
        const alert: DramaAlert = {
          id: `alert-${++msgCounter}`,
          message: data.message,
          tick: event.tick,
        }
        set(state => ({
          dramaAlerts: [...state.dramaAlerts.slice(-20), alert],
        }))
        break
      }

      case 'agent_move': {
        const data = event.data as {
          agentId: string
          location: LocationId
          position: { x: number; y: number }
        }
        const currentAgent = get().agents.find(a => a.id === data.agentId)
        if (currentAgent) {
          // Compute walking path from current position to new position
          const fromPos = storeRemapPosition(currentAgent.location, currentAgent.position)
          const toPos = storeRemapPosition(data.location, data.position)
          const path = findPath(currentAgent.location, fromPos, data.location, toPos)

          // Start walking animation
          useWalkingStore.getState().startWalk(
            data.agentId,
            fromPos,
            path,
            () => {
              // Update store position when walk completes
              set(state => ({
                agents: state.agents.map(a =>
                  a.id === data.agentId
                    ? { ...a, location: data.location, position: data.position }
                    : a
                ),
              }))
              // Return to idle animation on arrival
              useAnimationStore.getState().setAnimationState(data.agentId, 'idle')
              useAnimationStore.getState().setFacingOverride(data.agentId, null)
            }
          )

          // Update location immediately (so other systems know destination room)
          // but DON'T update position — let walkingStore handle interpolation
          set(state => ({
            agents: state.agents.map(a =>
              a.id === data.agentId
                ? { ...a, location: data.location }
                : a
            ),
          }))
        } else {
          // Agent not found yet — just set position directly (no walk animation)
          set(state => ({
            agents: state.agents.map(a =>
              a.id === data.agentId
                ? { ...a, location: data.location, position: data.position }
                : a
            ),
          }))
        }
        break
      }

      case 'event_start': {
        const data = event.data as { eventType: string; [key: string]: unknown }
        set(state => ({
          dramaAlerts: [
            ...state.dramaAlerts.slice(-20),
            {
              id: `event-${++msgCounter}`,
              message: eventTypeToMessage(data.eventType),
              tick: event.tick,
            },
          ],
        }))

        // Tok-show overlay
        if (data.eventType === 'tok_show' && data.topic && data.statements) {
          set({
            activeTokShow: {
              topic: data.topic as string,
              statements: data.statements as Array<{ agentId: string; name: string; text: string }>,
            },
          })
          // Auto-clear after 40 seconds
          setTimeout(() => set({ activeTokShow: null }), 40000)
        }

        // Confessional overlay
        if (data.eventType === 'confessional' && data.agentName) {
          set({
            activeConfessional: {
              agentId: (data.agentId as string) ?? '',
              name: (data.agentName as string) ?? '',
              text: (data.text as string) ?? 'Мысли вслух...',
              emotion: data.emotion as string | undefined,
            },
          })
          setTimeout(() => set({ activeConfessional: null }), 15000)
        }
        break
      }

      case 'eviction': {
        const data = event.data as { agentId: string; name: string; day: number }
        // Drama alert
        set(state => ({
          dramaAlerts: [
            ...state.dramaAlerts.slice(-20),
            {
              id: `evict-${++msgCounter}`,
              message: `${data.name} покидает проект! День ${data.day}`,
              tick: event.tick,
            },
          ],
          // Eviction overlay
          activeEviction: { agentId: data.agentId, name: data.name, day: data.day },
        }))
        break
      }
    }
  },

  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  setConnected: (connected) => set({ isConnected: connected }),
  setFullAgent: (agent) => set(state => {
    const map = new Map(state.fullAgents)
    map.set(agent.id, agent)
    return { fullAgents: map }
  }),
  clearEviction: () => set({ activeEviction: null }),
  clearConfessional: () => set({ activeConfessional: null }),
}))

function eventTypeToMessage(type: string): string {
  switch (type) {
    case 'tok_show': return 'Начинается ток-шоу на поляне!'
    case 'voting': return 'Голосование за выселение!'
    case 'breakfast': return 'Завтрак на кухне'
    case 'lunch': return 'Обед'
    case 'dinner': return 'Ужин'
    case 'confessional': return 'Кто-то в конфессионной...'
    default: return `Событие: ${type}`
  }
}
