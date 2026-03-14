// Persistence layer — auto-save simulation state, resume on restart

import * as fs from 'fs'
import * as path from 'path'
import type {
  Agent, Relationship, Memory, Conversation, GameEvent,
  GameClock, DramaScore, VotingSession, GossipItem,
} from './types'

const SAVE_DIR = path.join(process.cwd(), 'data')
const SAVE_PATH = path.join(SAVE_DIR, 'simulation-save.json')
const BACKUP_PATH = path.join(SAVE_DIR, 'simulation-save.backup.json')

const SAVE_VERSION = 1

export interface SaveFile {
  version: number
  savedAt: string
  state: {
    agents: Agent[]
    clock: GameClock
    drama: DramaScore
    isRunning: boolean
    votingQueue: string[]
  }
  subsystems: {
    relationships: Relationship[]
    shortTermMemories: Record<string, Memory[]>
    longTermMemories: Record<string, Memory[]>
    conversations: Array<Conversation & { _raw: true }>
    events: GameEvent[]
    schedulerState: {
      lastTokShowDay: number
      lastVotingDay: number
    }
    votingSessions: VotingSession[]
    gossipItems: Array<{
      id: string
      originContent: string
      currentContent: string
      originAgentId: string
      spreadPath: string[]
      tick: number
      aboutAgentIds: string[]
      distortionLevel: number
    }>
  }
  simulationMeta: {
    lastReflectionTick: number
    reflectionRotation: number
    lastPlanDay: number
    recentAlerts: Array<[string, number]>
  }
}

function ensureDir() {
  if (!fs.existsSync(SAVE_DIR)) {
    fs.mkdirSync(SAVE_DIR, { recursive: true })
  }
}

/**
 * Atomic write: write to .tmp, then rename. Backup current save first.
 */
export function saveSimulation(save: SaveFile): void {
  ensureDir()
  const tmpPath = SAVE_PATH + '.tmp'

  // Backup existing save
  if (fs.existsSync(SAVE_PATH)) {
    try {
      fs.copyFileSync(SAVE_PATH, BACKUP_PATH)
    } catch (err) {
      console.warn('[Persistence] Failed to create backup:', err)
    }
  }

  // Write to tmp, then rename (atomic on most filesystems)
  fs.writeFileSync(tmpPath, JSON.stringify(save), 'utf-8')
  fs.renameSync(tmpPath, SAVE_PATH)
}

/**
 * Load and parse save file. Returns null if not found or corrupt.
 */
export function loadSimulation(): SaveFile | null {
  if (!fs.existsSync(SAVE_PATH)) return null

  try {
    const raw = fs.readFileSync(SAVE_PATH, 'utf-8')
    const save = JSON.parse(raw) as SaveFile

    // Version check / migration
    if (!save.version || save.version > SAVE_VERSION) {
      console.warn(`[Persistence] Save file version ${save.version} not supported (current: ${SAVE_VERSION})`)
      return null
    }

    return save
  } catch (err) {
    console.error('[Persistence] Failed to load save:', err)

    // Try backup
    if (fs.existsSync(BACKUP_PATH)) {
      try {
        const raw = fs.readFileSync(BACKUP_PATH, 'utf-8')
        const save = JSON.parse(raw) as SaveFile
        console.log('[Persistence] Loaded from backup')
        return save
      } catch {
        console.error('[Persistence] Backup also corrupt')
      }
    }

    return null
  }
}

export function hasSaveFile(): boolean {
  return fs.existsSync(SAVE_PATH)
}

export function deleteSave(): void {
  if (fs.existsSync(SAVE_PATH)) fs.unlinkSync(SAVE_PATH)
  if (fs.existsSync(BACKUP_PATH)) fs.unlinkSync(BACKUP_PATH)
}
