import { NextRequest } from 'next/server'
import { subscribeSSE, getSimulation } from '../../../../engine/simulationManager'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    start(controller) {
      const send = (data: unknown) => {
        try {
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))
        } catch {
          // Client disconnected
        }
      }

      // Send initial ping
      send({ type: 'connected', tick: 0, data: {} })

      // Send catch-up summary
      try {
        const sim = getSimulation()
        const catchUpData = sim.getCatchUpData()
        send({ type: 'catch_up', tick: sim.state.clock.tick, data: catchUpData })
      } catch {
        // Simulation might not be ready yet
      }

      const unsubscribe = subscribeSSE((event) => {
        send(event)
      })

      // Clean up on close
      req.signal.addEventListener('abort', () => {
        unsubscribe()
      })
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}
