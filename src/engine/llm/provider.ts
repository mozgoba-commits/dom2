import { LLMMessage, LLMModel, LLMProvider, LLMResponse } from '../types'
import { budgetTracker, LLMCallPriority } from './budgetTracker'
import { BudgetExceededError } from './errors'

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

export function isLLMAvailable(priority: LLMCallPriority = LLMCallPriority.CONVERSATION): boolean {
  if (!currentProvider) return false
  return budgetTracker.isBudgetAvailable(priority)
}

export async function llmGenerate(
  messages: LLMMessage[],
  model: LLMModel = 'cheap',
  priority: LLMCallPriority = LLMCallPriority.CONVERSATION,
): Promise<LLMResponse> {
  if (!budgetTracker.isBudgetAvailable(priority)) {
    throw new BudgetExceededError()
  }

  const provider = getLLMProvider()
  try {
    const response = await provider.generate(messages, model)
    budgetTracker.recordCall(priority, response.usage)
    return response
  } catch (err) {
    budgetTracker.recordError()
    throw err
  }
}

export async function llmGenerateJSON<T>(
  messages: LLMMessage[],
  model: LLMModel = 'cheap',
  priority: LLMCallPriority = LLMCallPriority.CONVERSATION,
): Promise<T> {
  const response = await llmGenerate(messages, model, priority)
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
