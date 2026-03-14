import { Agent, AgentNeeds, EmotionalState, Mood } from '../types'

// --- Emotional Contagion ---

const CONTAGION_MULTIPLIERS: Record<string, number> = {
  anger: 1.5,
  excitement: 1.2,
  sadness: 1.0,
  fear: 1.1,
  happiness: 0.8,
  jealousy: 0.6,
  love: 0.3,
}

export function applyEmotionalContagion(agent: Agent, nearbyAgents: Agent[]): EmotionalState {
  let emotions = { ...agent.emotions }
  const sensitivity = agent.traits.sensitivity / 100

  for (const other of nearbyAgents) {
    if (other.id === agent.id) continue
    for (const [key, multiplier] of Object.entries(CONTAGION_MULTIPLIERS)) {
      const k = key as keyof Omit<EmotionalState, 'currentMood'>
      const otherVal = other.emotions[k] as number
      if (otherVal > 60) {
        const contagion = (otherVal / 100) * sensitivity * 10 * multiplier
        emotions[k] = Math.min(100, (emotions[k] as number) + contagion)
      }
    }
  }

  emotions.currentMood = calculateMoodPublic(emotions)
  return emotions
}

// --- Stress Level ---

export function calculateStressLevel(agent: Agent): number {
  const needs = agent.needs
  const avgNeeds = (needs.socialNeed + needs.validationNeed + needs.intimacyNeed + needs.dominanceNeed) / 4
  const maxNegativeEmotion = Math.max(
    agent.emotions.anger,
    agent.emotions.sadness,
    agent.emotions.fear,
    agent.emotions.jealousy
  )
  const energyPenalty = agent.energy < 30 ? 20 : 0

  return Math.min(100, Math.max(0,
    (100 - avgNeeds) * 0.3 + maxNegativeEmotion * 0.4 + energyPenalty
  ))
}

function calculateMoodPublic(e: EmotionalState): Mood {
  const dominant = [
    { mood: 'angry' as Mood, val: e.anger },
    { mood: 'happy' as Mood, val: e.happiness },
    { mood: 'sad' as Mood, val: e.sadness },
    { mood: 'excited' as Mood, val: e.excitement },
    { mood: 'jealous' as Mood, val: e.jealousy },
    { mood: 'flirty' as Mood, val: e.love > 60 ? e.love : 0 },
    { mood: 'anxious' as Mood, val: e.fear },
  ]
  const strongest = dominant.reduce((a, b) => a.val > b.val ? a : b)
  if (strongest.val < 30) return 'neutral'
  if (strongest.val > 80) {
    if (strongest.mood === 'happy') return 'euphoric'
    if (strongest.mood === 'sad') return 'devastated'
  }
  return strongest.mood
}

// --- Need Decay Rates (per tick) ---

export function decayNeeds(agent: Agent): AgentNeeds {
  const { traits, needs } = agent
  const extravertDecay = traits.extraversion / 100

  return {
    socialNeed: Math.max(0, needs.socialNeed - (1.5 + extravertDecay * 1.5)),
    validationNeed: Math.max(0, needs.validationNeed - (0.8 + (traits.neuroticism / 100) * 1.2)),
    intimacyNeed: Math.max(0, needs.intimacyNeed - (0.5 + (traits.flirtatiousness / 100) * 1.0)),
    dominanceNeed: Math.max(0, needs.dominanceNeed - (0.3 + (traits.stubbornness / 100) * 0.7)),
  }
}

// --- Emotion Decay ---

export function decayEmotions(emotions: EmotionalState): EmotionalState {
  const decay = (val: number, rate: number) => Math.max(0, val - rate)
  const grow = (val: number, rate: number) => Math.min(100, val + rate)

  const newEmotions = {
    ...emotions,
    happiness: emotions.happiness > 50 ? decay(emotions.happiness, 1) : grow(emotions.happiness, 0.5),
    anger: decay(emotions.anger, 4),
    sadness: decay(emotions.sadness, 1),
    fear: decay(emotions.fear, 1.5),
    excitement: decay(emotions.excitement, 2),
    jealousy: decay(emotions.jealousy, 0.5),
    love: decay(emotions.love, 0.2),
    currentMood: emotions.currentMood,
  }

  newEmotions.currentMood = calculateMood(newEmotions)
  return newEmotions
}

function calculateMood(e: EmotionalState): Mood {
  const dominant = [
    { mood: 'angry' as Mood, val: e.anger },
    { mood: 'happy' as Mood, val: e.happiness },
    { mood: 'sad' as Mood, val: e.sadness },
    { mood: 'excited' as Mood, val: e.excitement },
    { mood: 'jealous' as Mood, val: e.jealousy },
    { mood: 'flirty' as Mood, val: e.love > 60 ? e.love : 0 },
    { mood: 'anxious' as Mood, val: e.fear },
  ]

  const strongest = dominant.reduce((a, b) => a.val > b.val ? a : b)
  if (strongest.val < 30) return 'neutral'
  if (strongest.val > 80) {
    if (strongest.mood === 'happy') return 'euphoric'
    if (strongest.mood === 'sad') return 'devastated'
  }
  return strongest.mood
}

// --- Need Satisfaction ---

export function satisfyNeed(
  needs: AgentNeeds,
  need: keyof AgentNeeds,
  amount: number
): AgentNeeds {
  return {
    ...needs,
    [need]: Math.min(100, needs[need] + amount),
  }
}

// --- Emotional Impact ---

export function applyEmotionalImpact(
  emotions: EmotionalState,
  impact: Partial<Omit<EmotionalState, 'currentMood'>>
): EmotionalState {
  const newEmotions = { ...emotions }
  for (const [key, val] of Object.entries(impact)) {
    if (key === 'currentMood') continue
    const k = key as keyof Omit<EmotionalState, 'currentMood'>
    newEmotions[k] = Math.max(0, Math.min(100, (newEmotions[k] as number) + (val as number)))
  }
  newEmotions.currentMood = calculateMood(newEmotions)
  return newEmotions
}

// --- Critical Needs Check ---

export function getCriticalNeeds(agent: Agent): (keyof AgentNeeds)[] {
  const critical: (keyof AgentNeeds)[] = []
  const threshold = 30
  if (agent.needs.socialNeed < threshold) critical.push('socialNeed')
  if (agent.needs.validationNeed < threshold) critical.push('validationNeed')
  if (agent.needs.intimacyNeed < threshold) critical.push('intimacyNeed')
  if (agent.needs.dominanceNeed < threshold) critical.push('dominanceNeed')
  return critical
}

// --- Energy ---

export function decayEnergy(agent: Agent): number {
  const base = 0.5
  const activityPenalty = agent.status === 'in_conversation' ? 0.3 : 0
  return Math.max(0, agent.energy - base - activityPenalty)
}

export function recoverEnergy(agent: Agent): number {
  const recovery = agent.status === 'sleeping' ? 5 : 0.5
  return Math.min(100, agent.energy + recovery)
}

// --- Gossip Urge ---

export function updateGossipUrge(agent: Agent, sawSomethingInteresting: boolean): number {
  const base = sawSomethingInteresting ? 30 : -2
  const traitBonus = (agent.traits.dramaTendency / 100) * 20
  return Math.max(0, Math.min(100, agent.gossipUrge + base + (sawSomethingInteresting ? traitBonus : 0)))
}
