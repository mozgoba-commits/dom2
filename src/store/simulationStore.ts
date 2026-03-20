'use client'

import { create } from 'zustand'
import type { DramaScore, GameClock, Mood, LocationId, SSEEvent, EpisodeInfo } from '../engine/types'
import { findPath } from '../engine/pathfinding'
import { remapPosition } from '../engine/coordinates'
import { useWalkingStore } from './walkingStore'
import { useAnimationStore } from './animationStore'

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

interface FinaleData {
  winnerId: string
  winnerName: string
  episode?: EpisodeInfo
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface CatchUpData {
  clock?: GameClock
  activeAgentCount?: number
  evictions?: Array<{ name: string; day: number | null }>
  episode?: EpisodeInfo
  drama?: DramaScore
  relationshipHighlights?: {
    friends: Array<{ a: string; b: string; score: number }>
    rivals: Array<{ a: string; b: string; score: number }>
    romances: Array<{ a: string; b: string; score: number }>
  }
  speed?: number
  isPaused?: boolean
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

  // Episode & speed
  episode: EpisodeInfo | null
  simulationSpeed: number
  isPaused: boolean

  // Event overlays
  activeTokShow: TokShowData | null
  activeEviction: EvictionData | null
  activeConfessional: ConfessionalData | null
  finaleData: FinaleData | null
  catchUpData: CatchUpData | null

  // UI state
  selectedAgentId: string | null

  // Actions
  handleSSEEvent: (event: SSEEvent) => void
  setSelectedAgent: (id: string | null) => void
  setConnected: (connected: boolean) => void
  clearEviction: () => void
  clearConfessional: () => void
  dismissCatchUp: () => void
}

function computeFacing(aPos: { x: number; y: number }, bPos: { x: number; y: number }): 'left' | 'right' {
  return aPos.x > bPos.x ? 'left' : 'right'
}

let msgCounter = 0
let tokShowTimer: ReturnType<typeof setTimeout> | null = null
let confessionalTimer: ReturnType<typeof setTimeout> | null = null

export const useSimulationStore = create<SimulationStore>((set, get) => ({
  agents: [],
  clock: null,
  drama: null,
  activeEvents: [],
  chatMessages: [],
  dramaAlerts: [],
  isConnected: false,
  episode: null,
  simulationSpeed: 1,
  isPaused: false,
  activeTokShow: null,
  activeEviction: null,
  activeConfessional: null,
  finaleData: null,
  catchUpData: null,
  selectedAgentId: null,

  handleSSEEvent: (event: SSEEvent) => {
    switch (event.type) {
      case 'state_update': {
        const data = event.data as {
          clock: GameClock
          agents: AgentSummary[]
          drama: DramaScore
          activeEvents: ActiveEvent[]
          episode?: EpisodeInfo
          speed?: number
          isPaused?: boolean
        }
        const prevAgents = get().agents
        set({
          clock: data.clock,
          agents: data.agents,
          drama: data.drama,
          activeEvents: data.activeEvents,
          ...(data.episode ? { episode: data.episode } : {}),
          ...(data.speed !== undefined ? { simulationSpeed: data.speed } : {}),
          ...(data.isPaused !== undefined ? { isPaused: data.isPaused } : {}),
        })

        // Initialize ALL agents in animation store + set states from status
        const animStore = useAnimationStore.getState()
        for (const agent of data.agents) {
          const existing = animStore.animations.get(agent.id)

          if (agent.status === 'sleeping') {
            // Only show sleeping animation once agent has finished walking to bed
            if (!useWalkingStore.getState().isWalking(agent.id)) {
              animStore.setAnimationState(agent.id, 'sleeping')
            }
          } else if (agent.status === 'in_conversation') {
            // Only set talking if not already in a more specific anim (arguing, flirting, etc.)
            if (!existing || existing.state === 'idle' || existing.state === 'walking') {
              animStore.setAnimationState(agent.id, 'talking')
            }
          } else if (!existing) {
            // First time seeing this agent — initialize to idle so breathing starts
            animStore.setAnimationState(agent.id, 'idle')
          } else if (existing.state !== 'idle' && existing.state !== 'walking' && agent.status === 'free') {
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
            const aPos = remapPosition(agent.location, agent.position)
            const pPos = remapPosition(partner.location, partner.position)
            animStore.setFacingOverride(agent.id, computeFacing(aPos, pPos))
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
            const sPos = remapPosition(speakerAgent.location, speakerAgent.position)
            const tPos = remapPosition(targetAgent.location, targetAgent.position)
            animStore.setFacingOverride(data.speakerId, computeFacing(sPos, tPos))
            animStore.setFacingOverride(partnerId, computeFacing(tPos, sPos))
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
          const fromPos = remapPosition(currentAgent.location, currentAgent.position)
          const toPos = remapPosition(data.location, data.position)
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
          if (tokShowTimer) clearTimeout(tokShowTimer)
          tokShowTimer = setTimeout(() => set({ activeTokShow: null }), 40000)
        }

        // Confessional overlay
        if (data.eventType === 'confessional' && data.agentName) {
          const confData = data as {
            eventType: string
            agentId: string
            agentName: string
            text?: string
            emotion?: string
          }
          set({
            activeConfessional: {
              agentId: confData.agentId ?? '',
              name: confData.agentName ?? '',
              text: confData.text ?? 'Мысли вслух...',
              emotion: confData.emotion,
            },
          })
          if (confessionalTimer) clearTimeout(confessionalTimer)
          confessionalTimer = setTimeout(() => set({ activeConfessional: null }), 15000)
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

      case 'catch_up': {
        const data = event.data as CatchUpData
        set({ catchUpData: data })
        if (data.speed !== undefined) set({ simulationSpeed: data.speed })
        if (data.isPaused !== undefined) set({ isPaused: data.isPaused })
        if (data.episode) set({ episode: data.episode })
        break
      }

      case 'episode_change': {
        const data = event.data as { episode: EpisodeInfo }
        set({ episode: data.episode })
        break
      }

      case 'finale': {
        const data = event.data as unknown as FinaleData
        set({ finaleData: data })
        break
      }

      case 'vote_update': {
        // Could update voting UI with live totals if needed
        break
      }
    }
  },

  setSelectedAgent: (id) => set({ selectedAgentId: id }),
  setConnected: (connected) => set({ isConnected: connected }),
  clearEviction: () => set({ activeEviction: null }),
  clearConfessional: () => set({ activeConfessional: null }),
  dismissCatchUp: () => set({ catchUpData: null }),
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
