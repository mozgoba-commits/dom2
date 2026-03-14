import { NextRequest, NextResponse } from 'next/server'
import { getSimulation } from '../../../../engine/simulationManager'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { speed } = body as { speed: number }

    if (speed === undefined || ![0, 1, 2, 5].includes(speed)) {
      return NextResponse.json({ error: 'Speed must be 0, 1, 2, or 5' }, { status: 400 })
    }

    const sim = getSimulation()

    if (speed === 0) {
      sim.pause()
    } else {
      sim.setSpeed(speed)
    }

    return NextResponse.json({ speed: sim.getSpeed(), isPaused: sim.isPaused() })
  } catch (error) {
    console.error('[API] speed error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
