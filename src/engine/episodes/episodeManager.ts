// Episode structure — organizes the simulation into weekly episodes

import type { GameClock, EpisodeInfo } from '../types'

const DAYS_PER_EPISODE = 7

/**
 * Calculate current episode info from clock and active agent count.
 */
export function calculateEpisode(clock: GameClock, activeAgentCount: number): EpisodeInfo {
  const episodeNumber = Math.ceil(clock.day / DAYS_PER_EPISODE)
  const dayWithinEpisode = ((clock.day - 1) % DAYS_PER_EPISODE) + 1
  const isFinale = activeAgentCount <= 3

  let phase: EpisodeInfo['phase']
  if (isFinale) phase = 'finale'
  else if (episodeNumber <= 2) phase = 'early'
  else if (episodeNumber <= 4) phase = 'mid'
  else phase = 'late'

  return { episodeNumber, dayWithinEpisode, isFinale, phase }
}

/**
 * Check if voting should happen based on episode structure.
 * Voting on day 7 of each episode.
 */
export function isVotingDay(episode: EpisodeInfo): boolean {
  return episode.dayWithinEpisode === 7 && !episode.isFinale
}

/**
 * Check if tok show should happen based on episode structure.
 * Tok shows on days 3 and 5 of each episode.
 */
export function isTokShowDay(episode: EpisodeInfo): boolean {
  return episode.dayWithinEpisode === 3 || episode.dayWithinEpisode === 5
}

/**
 * Determine winner by highest combined friendship score.
 */
export function determineWinner(
  agentIds: string[],
  relationships: Array<{ agentAId: string; agentBId: string; friendship: number }>
): string | null {
  if (agentIds.length === 0) return null
  if (agentIds.length === 1) return agentIds[0]

  let bestId: string | null = null
  let bestScore = -Infinity

  for (const id of agentIds) {
    const score = relationships
      .filter(r => r.agentAId === id || r.agentBId === id)
      .reduce((sum, r) => sum + r.friendship, 0)

    if (score > bestScore) {
      bestScore = score
      bestId = id
    }
  }

  return bestId
}
