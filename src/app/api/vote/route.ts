import { NextRequest, NextResponse } from 'next/server'
import { getSimulation } from '../../../engine/simulationManager'

export async function POST(req: NextRequest) {
  const body = await req.json()
  const { sessionId, visitorId, nomineeId } = body

  if (!sessionId || !visitorId || !nomineeId) {
    return NextResponse.json(
      { error: 'Missing required fields: sessionId, visitorId, nomineeId' },
      { status: 400 }
    )
  }

  const sim = getSimulation()
  const success = sim.addUserVote(sessionId, visitorId, nomineeId)

  if (!success) {
    return NextResponse.json(
      { error: 'Invalid vote — session may be closed or nominee invalid' },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true })
}

export async function GET() {
  const sim = getSimulation()
  const session = sim.getVotingSession()

  if (!session) {
    return NextResponse.json({ active: false })
  }

  const agents = sim.state.agents
  return NextResponse.json({
    active: true,
    sessionId: session.id,
    nominees: session.nominees.map(id => {
      const agent = agents.find(a => a.id === id)
      return { id, name: agent?.bio.name ?? 'Unknown' }
    }),
    totalVotes: Object.keys(session.votes).length + Object.keys(session.userVotes).length,
  })
}
