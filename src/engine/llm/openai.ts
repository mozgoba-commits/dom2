import { LLMMessage, LLMModel, LLMProvider, LLMResponse } from '../types'

const MODEL_MAP: Record<LLMModel, string> = {
  cheap: 'gpt-4o-mini',
  strong: 'gpt-4o',
}

export class OpenAIProvider implements LLMProvider {
  name = 'openai'
  private apiKey: string
  private baseUrl: string

  constructor(apiKey: string, baseUrl = 'https://api.openai.com') {
    this.apiKey = apiKey
    this.baseUrl = baseUrl
  }

  async generate(messages: LLMMessage[], model: LLMModel): Promise<LLMResponse> {
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
    })

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
  }
}
