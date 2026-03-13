import { LLMMessage, LLMModel, LLMProvider, LLMResponse } from '../types'

const MODEL_MAP: Record<LLMModel, string> = {
  cheap: 'claude-haiku-4-5-20251001',
  strong: 'claude-sonnet-4-6',
}

export class ClaudeProvider implements LLMProvider {
  name = 'claude'
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl = 'https://api.anthropic.com') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async generate(messages: LLMMessage[], model: LLMModel): Promise<LLMResponse> {
    const systemMsg = messages.find(m => m.role === 'system')
    const nonSystemMsgs = messages.filter(m => m.role !== 'system')

    const body: Record<string, unknown> = {
      model: MODEL_MAP[model],
      max_tokens: 1024,
      messages: nonSystemMsgs.map(m => ({ role: m.role, content: m.content })),
    }
    if (systemMsg) {
      body.system = systemMsg.content
    }

    const res = await fetch(`${this.baseUrl}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': this.apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify(body),
    })

    if (!res.ok) {
      const text = await res.text()
      throw new Error(`Claude API error ${res.status}: ${text}`)
    }

    const data = await res.json()
    const content = data.content?.[0]?.text ?? ''

    return {
      content,
      usage: {
        inputTokens: data.usage?.input_tokens ?? 0,
        outputTokens: data.usage?.output_tokens ?? 0,
      },
    }
  }
}
