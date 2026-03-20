import { Agent, AgentNeeds } from '../types'

export interface AttractionScore {
  targetId: string
  score: number       // -100 to 100
  reasons: string[]
}

/**
 * Calculate how drawn agent A is to interact with agent B.
 * Positive = wants to interact, negative = wants to avoid.
 */
export function calculateAttraction(a: Agent, b: Agent): AttractionScore {
  let score = 0
  const reasons: string[] = []

  // --- Manipulator → Trusting target ---
  if (a.traits.manipulativeness > 60 && b.traits.agreeableness > 70) {
    score += 25
    reasons.push('видит лёгкую жертву')
  }

  // --- Alpha clash ---
  if (
    a.traits.extraversion > 70 && a.traits.agreeableness < 35 &&
    b.traits.extraversion > 70 && b.traits.agreeableness < 35
  ) {
    score += 15 // they're drawn to conflict
    reasons.push('столкновение лидеров')
  }

  // --- Romantic attraction ---
  if (a.traits.flirtatiousness > 60 && b.traits.flirtatiousness > 40) {
    const genderAttraction = a.bio.gender !== b.bio.gender ? 20 : 5
    score += genderAttraction
    reasons.push('романтический интерес')
  }

  // --- Comedian seeks audience ---
  if (a.traits.humor > 70 && b.traits.extraversion > 50) {
    score += 10
    reasons.push('ищет аудиторию для шуток')
  }

  // --- Drama magnet ---
  if (a.traits.dramaTendency > 70 && b.traits.sensitivity > 60) {
    score += 15
    reasons.push('чувствует потенциал для драмы')
  }

  // --- Comfort seeking ---
  if (a.traits.sensitivity > 70 && b.traits.agreeableness > 60) {
    score += 15
    reasons.push('ищет поддержку')
  }

  // --- Opposites on conscientiousness ---
  if (Math.abs(a.traits.conscientiousness - b.traits.conscientiousness) > 50) {
    score += 10
    reasons.push('притяжение противоположностей')
  }

  // --- Stubbornness repulsion (unless both love arguing) ---
  if (a.traits.stubbornness > 70 && b.traits.stubbornness > 70) {
    if (a.traits.dramaTendency > 50) {
      score += 10
      reasons.push('оба упрямые — конфликт неизбежен')
    } else {
      score -= 10
      reasons.push('слишком упрямые, избегают друг друга')
    }
  }

  // --- Loyalty bonding ---
  if (a.traits.loyalty > 70 && b.traits.loyalty > 70) {
    score += 15
    reasons.push('родственные души, верные')
  }

  return { targetId: b.id, score: Math.max(-100, Math.min(100, score)), reasons }
}

/**
 * Pick the best interaction target based on needs, attraction, and availability.
 */
export function pickInteractionTarget(
  agent: Agent,
  others: Agent[],
  criticalNeed: keyof AgentNeeds | null
): { target: Agent; reason: string } | null {
  const available = others.filter(
    o => !o.isEvicted && o.status === 'free' && o.id !== agent.id
  )

  if (available.length === 0) return null

  const scored = available.map(other => {
    const attraction = calculateAttraction(agent, other)
    let needBonus = 0
    let reason = attraction.reasons[0] ?? 'просто так'

    // Boost based on critical need
    if (criticalNeed === 'socialNeed') {
      // Seek anyone, prefer extraverts
      needBonus += 10 + other.traits.extraversion / 10
      reason = 'нужно пообщаться'
    } else if (criticalNeed === 'validationNeed') {
      // Seek agreeable people
      needBonus += other.traits.agreeableness / 5
      reason = 'нужно одобрение'
    } else if (criticalNeed === 'intimacyNeed') {
      // Seek romantic targets
      if (agent.bio.gender !== other.bio.gender) {
        needBonus += 15 + other.traits.flirtatiousness / 5
      }
      reason = 'ищет близость'
    } else if (criticalNeed === 'dominanceNeed') {
      // Seek someone to dominate (low agreeableness targets resist = more drama)
      needBonus += 10 + (100 - other.traits.agreeableness) / 10
      reason = 'хочет показать кто главный'
    }

    // Gossip urge boost
    if (agent.gossipUrge > 50) {
      const gossipBonus = other.traits.dramaTendency > 50 ? 15 : 5
      needBonus += gossipBonus
    }

    // Same location bonus
    const locationBonus = agent.location === other.location ? 20 : 0

    return {
      other,
      totalScore: attraction.score + needBonus + locationBonus,
      reason,
    }
  })

  scored.sort((a, b) => b.totalScore - a.totalScore)

  // Add some randomness — don't always pick the top choice
  const topN = scored.slice(0, 3)
  const pick = topN[Math.floor(Math.random() * topN.length)]

  return pick ? { target: pick.other, reason: pick.reason } : null
}
