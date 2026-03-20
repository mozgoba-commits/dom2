import { NextResponse } from 'next/server'
import { getSimulation } from '../../../engine/simulationManager'

export async function GET() {
  try {
    const sim = getSimulation()
    const { agents } = sim.state

    const agentList = agents
      .filter(a => !a.isEvicted)
      .map(a => ({
        id: a.id,
        name: a.bio.name,
        accentColor: getAccentForAgent(a.bio.name),
      }))

    // Get all relationships
    const allRels = sim.state.relationships
    const relationships = allRels.map(r => ({
      agentA: r.agentAId,
      agentB: r.agentBId,
      friendship: r.friendship,
      romance: r.romance,
      trust: r.trust,
      rivalry: r.rivalry,
      alliance: r.alliance,
    }))

    return NextResponse.json({ agents: agentList, relationships })
  } catch (error) {
    console.error('[API] relationships error:', error)
    return NextResponse.json({ agents: [], relationships: [] })
  }
}

// Inline accent lookup to avoid importing client-side module
const ACCENT_COLORS: Record<string, string> = {
  'Руслан': '#e63946', 'Тимур': '#457b9d', 'Алёна': '#f4a261',
  'Кристина': '#e76f51', 'Марина': '#2a9d8f', 'Настя': '#f9c74f',
  'Дима': '#90be6d', 'Олег': '#9b5de5',
}

function getAccentForAgent(name: string): string {
  return ACCENT_COLORS[name] ?? '#888899'
}
