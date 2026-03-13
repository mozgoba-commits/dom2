import { LLMMessage, LLMModel, LLMProvider, LLMResponse } from '../types'

let currentProvider: LLMProvider | null = null

export function setLLMProvider(provider: LLMProvider) {
  currentProvider = provider
}

export function getLLMProvider(): LLMProvider {
  if (!currentProvider) {
    throw new Error('LLM provider not configured. Call setLLMProvider() first.')
  }
  return currentProvider
}

export async function llmGenerate(
  messages: LLMMessage[],
  model: LLMModel = 'cheap'
): Promise<LLMResponse> {
  const provider = getLLMProvider()
  return provider.generate(messages, model)
}

export async function llmGenerateJSON<T>(
  messages: LLMMessage[],
  model: LLMModel = 'cheap'
): Promise<T> {
  const response = await llmGenerate(messages, model)
  try {
    // Extract JSON from response (handle markdown code blocks)
    let content = response.content.trim()
    const jsonMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/)
    if (jsonMatch) {
      content = jsonMatch[1].trim()
    }
    return JSON.parse(content) as T
  } catch {
    throw new Error(`Failed to parse LLM response as JSON: ${response.content.slice(0, 200)}`)
  }
}
