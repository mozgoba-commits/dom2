import { NextRequest, NextResponse } from 'next/server'
import { getSimulation } from '../../../../engine/simulationManager'

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const sim = getSimulation()
  const agent = sim.getAgent(id)

  if (!agent) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
  }

  const relationships = sim.getRelationships(id).map(r => {
    const otherId = r.agentAId === id ? r.agentBId : r.agentAId
    const other = sim.getAgent(otherId)
    return {
      agentId: otherId,
      name: other?.bio.name ?? 'Unknown',
      friendship: r.friendship,
      romance: r.romance,
      trust: r.trust,
      rivalry: r.rivalry,
      alliance: r.alliance,
    }
  })

  const memories = sim.getMemories(id).map(m => ({
    content: m.content,
    type: m.type,
    tick: m.tick,
    importance: m.importance,
  }))

  return NextResponse.json({
    agent: {
      ...agent,
      // Don't expose raw trait numbers to public API (keep it narrative)
    },
    relationships,
    memories,
  })
}
