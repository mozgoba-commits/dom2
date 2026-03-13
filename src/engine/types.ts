// ============================================================
// DOM2 AI — Core Type Definitions
// ============================================================

// --- Personality Traits ---

export interface BigFiveTraits {
  openness: number          // 0-100
  conscientiousness: number
  extraversion: number
  agreeableness: number
  neuroticism: number
}

export interface Dom2Traits {
  flirtatiousness: number   // 0-100
  jealousy: number
  loyalty: number
  manipulativeness: number
  dramaTendency: number
  humor: number
  stubbornness: number
  sensitivity: number
}

export type AllTraits = BigFiveTraits & Dom2Traits

// --- Needs ---

export interface AgentNeeds {
  socialNeed: number        // 0-100, decays over time
  validationNeed: number
  intimacyNeed: number
  dominanceNeed: number
}

// --- Emotions ---

export interface EmotionalState {
  happiness: number         // 0-100
  anger: number
  sadness: number
  fear: number
  excitement: number
  jealousy: number
  love: number
  currentMood: Mood
}

export type Mood =
  | 'happy' | 'angry' | 'sad' | 'excited' | 'jealous'
  | 'flirty' | 'bored' | 'anxious' | 'neutral' | 'annoyed'
  | 'devastated' | 'euphoric' | 'scheming'

// --- Agent Bio ---

export interface AgentBio {
  name: string
  surname: string
  age: number
  gender: 'male' | 'female'
  hometown: string
  occupation: string
  education: string
  hobbies: string[]
  favoriteMusic: string
  favoriteFood: string
  fears: string[]
  lifeGoal: string
  reasonForComing: string
  idealPartner: string
  catchphrase: string
  funFact: string
  physicalDescription: string
  secretGoal?: string         // Hidden agenda
  vulnerabilities?: string[]  // Emotional weak points
}

// --- Agent ---

export type LocationId = 'yard' | 'bedroom' | 'living_room' | 'kitchen' | 'confessional'

export type AgentStatus = 'free' | 'in_conversation' | 'in_event' | 'sleeping' | 'moving'

export interface Agent {
  id: string
  bio: AgentBio
  archetype: string
  traits: AllTraits
  needs: AgentNeeds
  emotions: EmotionalState
  location: LocationId
  targetLocation: LocationId | null
  status: AgentStatus
  energy: number            // 0-100
  gossipUrge: number        // 0-100
  position: { x: number; y: number }
  isEvicted: boolean
  evictedOnDay: number | null
}

// --- Relationships ---

export interface Relationship {
  agentAId: string
  agentBId: string
  friendship: number        // -100 to 100
  romance: number           // 0 to 100
  trust: number             // -100 to 100
  rivalry: number           // 0 to 100
  alliance: boolean
  history: RelationshipEvent[]
}

export interface RelationshipEvent {
  tick: number
  type: 'positive' | 'negative' | 'romantic' | 'betrayal' | 'alliance'
  description: string
  impact: number            // -10 to 10
}

// --- Memory ---

export interface Memory {
  id: string
  agentId: string
  tick: number
  type: 'observation' | 'conversation' | 'gossip' | 'event' | 'emotion' | 'decision'
  content: string
  importance: number        // 0-10
  involvedAgents: string[]
  location: LocationId
  isGossip: boolean
  sourceAgentId?: string    // who told this gossip
  emotionalContext?: string    // "Чувствовал злость и обиду"
  narrativeSummary?: string   // Narrative first-person memory
}

// --- Conversations ---

export interface Conversation {
  id: string
  participants: string[]    // agent IDs
  location: LocationId
  messages: ConversationMessage[]
  startedAtTick: number
  endedAtTick: number | null
  topic: string | null
  isPrivate: boolean
  tension: number             // 0-10, escalation tracking
}

export interface ConversationMessage {
  agentId: string
  content: string
  tick: number
  emotion: Mood
  action?: string           // *встаёт и уходит*, *обнимает*
}

// --- Events ---

export type GameEventType =
  | 'breakfast' | 'lunch' | 'dinner'
  | 'tok_show' | 'voting' | 'confessional'
  | 'date' | 'new_arrival' | 'eviction'
  | 'free_time' | 'sleep'

export interface GameEvent {
  id: string
  type: GameEventType
  scheduledTick: number
  startedAtTick: number | null
  endedAtTick: number | null
  location: LocationId
  involvedAgents: string[]  // empty = all agents
  data?: Record<string, unknown>
}

// --- Decisions ---

export type ActionType =
  | 'move' | 'talk' | 'flirt' | 'argue'
  | 'gossip' | 'comfort' | 'manipulate'
  | 'avoid' | 'rest' | 'think' | 'cry'
  | 'celebrate' | 'confront' | 'apologize'
  | 'form_alliance' | 'break_alliance'

export interface AgentDecision {
  agentId: string
  action: ActionType
  targetAgentId?: string
  targetLocation?: LocationId
  reasoning: string
  urgency: number           // 0-10
}

// --- Game Clock ---

export interface GameClock {
  tick: number
  day: number
  hour: number              // 0-23
  minute: number            // 0-59
  timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night'
  ticksPerGameHour: number  // 6 ticks = 1 game hour (10min per tick)
}

// --- Drama ---

export interface DramaScore {
  overall: number           // 0-100
  conflicts: number
  romances: number
  betrayals: number
  alliances: number
  lastMajorEvent: string | null
  ticksSinceLastDrama: number
}

// --- Simulation State ---

export interface SimulationState {
  agents: Agent[]
  relationships: Relationship[]
  conversations: Conversation[]
  activeEvents: GameEvent[]
  clock: GameClock
  drama: DramaScore
  isRunning: boolean
  votingQueue: string[]     // agent IDs submitted by users
}

// --- SSE Events ---

export type SSEEventType =
  | 'state_update'
  | 'conversation'
  | 'agent_move'
  | 'emotion_change'
  | 'event_start'
  | 'event_end'
  | 'drama_alert'
  | 'vote_update'
  | 'eviction'

export interface SSEEvent {
  type: SSEEventType
  data: Record<string, unknown>
  tick: number
}

// --- LLM ---

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface LLMResponse {
  content: string
  usage?: { inputTokens: number; outputTokens: number }
}

export type LLMModel = 'cheap' | 'strong'

export interface LLMProvider {
  name: string
  generate(messages: LLMMessage[], model: LLMModel): Promise<LLMResponse>
}

// --- Voting ---

export interface VotingSession {
  id: string
  day: number
  nominees: string[]        // agent IDs
  votes: Record<string, string>  // voterId -> nomineeId
  userVotes: Record<string, string>
  result: string | null     // evicted agent ID
  isActive: boolean
}
