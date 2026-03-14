import { LLMMessage, LLMModel, LLMProvider, LLMResponse } from '../types'
import { RateLimitError, TimeoutError } from './errors'

const MODEL_MAP: Record<LLMModel, string> = {
  cheap: 'gpt-4o-mini',
  strong: 'gpt-4o',
}

const TIMEOUT_MS = 10_000

export class OpenAIProvider implements LLMProvider {
  name = 'openai'
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl = 'https://api.openai.com') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async generate(messages: LLMMessage[], model: LLMModel): Promise<LLMResponse> {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)

    try {
      const res = await fetch(`${this.baseUrl}/v1/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.apiKey}`,
        },
        body: JSON.stringify({
          model: MODEL_MAP[model],
          max_tokens: 1024,
          messages: messages.map(m => ({ role: m.role, content: m.content })),
        }),
        signal: controller.signal,
      })

      if (res.status === 429) {
        const retryAfter = parseInt(res.headers.get('retry-after') ?? '5') * 1000
        throw new RateLimitError(retryAfter)
      }

      if (!res.ok) {
        const text = await res.text()
        throw new Error(`OpenAI API error ${res.status}: ${text}`)
      }

      const data = await res.json()
      const content = data.choices?.[0]?.message?.content ?? ''

      return {
        content,
        usage: {
          inputTokens: data.usage?.prompt_tokens ?? 0,
          outputTokens: data.usage?.completion_tokens ?? 0,
        },
      }
    } catch (err) {
      if (err instanceof RateLimitError) throw err
      if (err instanceof Error && err.name === 'AbortError') {
        throw new TimeoutError(TIMEOUT_MS)
      }
      throw err
    } finally {
      clearTimeout(timeout)
    }
  }
}
