// Simple localStorage-based persistence for simulation state snapshots

const STORAGE_KEY = 'dom2_save'

export interface SaveData {
  version: number
  savedAt: string
  clock: { tick: number; day: number; hour: number }
  dramaAlerts: Array<{ id: string; message: string; tick: number }>
  chatMessages: Array<{
    id: string; speakerName: string; speakerId: string
    content: string; emotion: string; location: string; tick: number
  }>
}

export function saveSnapshot(data: SaveData): boolean {
  try {
    const json = JSON.stringify(data)
    localStorage.setItem(STORAGE_KEY, json)
    return true
  } catch {
    console.warn('[Persistence] Failed to save')
    return false
  }
}

export function loadSnapshot(): SaveData | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as SaveData
    if (data.version !== 1) return null
    return data
  } catch {
    return null
  }
}

export function hasSave(): boolean {
  return localStorage.getItem(STORAGE_KEY) !== null
}

export function deleteSave(): void {
  localStorage.removeItem(STORAGE_KEY)
}
