import { Simulation, SimulationEventHandler } from './simulation'
import { setLLMProvider } from './llm/provider'
import { ClaudeProvider } from './llm/claude'
import { OpenAIProvider } from './llm/openai'
import type { SSEEvent } from './types'

let simulation: Simulation | null = null

export function getSimulation(): Simulation {
  if (!simulation) {
    // Configure LLM provider
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    const openaiKey = process.env.OPENAI_API_KEY

    if (anthropicKey) {
      setLLMProvider(new ClaudeProvider(anthropicKey))
    } else if (openaiKey) {
      setLLMProvider(new OpenAIProvider(openaiKey))
    }

    const useLLM = !!(anthropicKey || openaiKey)
    simulation = new Simulation(useLLM)

    if (!useLLM) {
      console.warn('[Simulation] No LLM API key configured. Running in fallback mode.')
    }

    // Start with 5-second ticks
    simulation.start(5000)
  }
  return simulation
}

// SSE subscriber management
const subscribers = new Set<(event: SSEEvent) => void>()
let handlerRegistered = false

export function subscribeSSE(callback: (event: SSEEvent) => void): () => void {
  const sim = getSimulation()

  if (!handlerRegistered) {
    sim.onEvent((event) => {
      for (const sub of subscribers) {
        sub(event)
      }
    })
    handlerRegistered = true
  }

  subscribers.add(callback)
  return () => {
    subscribers.delete(callback)
  }
}
