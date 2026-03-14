// Gossip Network — gossip as objects with distortion and spread tracking

import { Agent } from '../types'
import { MemoryStore } from './memoryStore'
import { nanoid } from 'nanoid'

export interface GossipItem {
  id: string
  originContent: string       // original gossip
  currentContent: string      // potentially distorted
  originAgentId: string       // who created it
  spreadPath: string[]        // agent IDs who know it
  tick: number
  aboutAgentIds: string[]     // who it's about
  distortionLevel: number     // 0-1, how much it's been changed
}

const gossipItems: Map<string, GossipItem> = new Map()

export function createGossip(
  content: string,
  originAgentId: string,
  aboutAgentIds: string[],
  tick: number,
): GossipItem {
  const item: GossipItem = {
    id: nanoid(),
    originContent: content,
    currentContent: content,
    originAgentId,
    spreadPath: [originAgentId],
    tick,
    aboutAgentIds,
    distortionLevel: 0,
  }
  gossipItems.set(item.id, item)
  return item
}

export function spreadGossip(
  gossipId: string,
  spreader: Agent,
  receiver: Agent,
  memoryStore: MemoryStore,
  tick: number,
): GossipItem | null {
  const gossip = gossipItems.get(gossipId)
  if (!gossip) return null
  if (gossip.spreadPath.includes(receiver.id)) return null // already knows

  // Distortion based on loyalty (low loyalty = more distortion)
  const distortionChance = 1 - spreader.traits.loyalty / 100
  const dramaTendency = spreader.traits.dramaTendency / 100
  let content = gossip.currentContent

  if (Math.random() < distortionChance * 0.5) {
    // Dramatize the gossip
    const intensifiers = [
      'Причём это было при всех!',
      'И это ещё не всё...',
      'Говорят, это уже не в первый раз.',
      'Все в шоке.',
    ]
    if (dramaTendency > 0.5) {
      content += ' ' + intensifiers[Math.floor(Math.random() * intensifiers.length)]
    }
    gossip.distortionLevel = Math.min(1, gossip.distortionLevel + 0.2)
  }

  gossip.currentContent = content
  gossip.spreadPath.push(receiver.id)

  // Add gossip memory to receiver
  memoryStore.addMemory(
    receiver.id,
    tick,
    'gossip',
    content,
    5, // gossip is important
    gossip.aboutAgentIds,
    receiver.location,
    true,
    spreader.id,
  )

  return gossip
}

export function getBestGossipTarget(
  spreader: Agent,
  potentialReceivers: Agent[],
  allGossip: GossipItem[],
): { gossip: GossipItem; target: Agent } | null {
  // Find gossip this agent knows but target doesn't
  const knownGossip = allGossip.filter(g => g.spreadPath.includes(spreader.id))
  if (knownGossip.length === 0) return null

  for (const gossip of knownGossip) {
    for (const target of potentialReceivers) {
      if (target.id === spreader.id) continue
      if (gossip.spreadPath.includes(target.id)) continue
      // Prefer targets who would be most affected
      if (gossip.aboutAgentIds.includes(target.id)) continue // don't tell people about themselves
      return { gossip, target }
    }
  }

  return null
}

export function getGossipAbout(agentId: string): GossipItem[] {
  return [...gossipItems.values()].filter(g => g.aboutAgentIds.includes(agentId))
}
