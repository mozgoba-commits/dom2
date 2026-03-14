// Reflection engine — Stanford Generative Agents pattern
// Periodically synthesizes recent memories into insights

import { Agent, Memory } from '../types'
import { MemoryStore } from './memoryStore'
import { llmGenerate } from '../llm/provider'
import { buildAgentSystemPrompt, stripThinking } from '../llm/promptBuilder'

export function buildReflectionPrompt(agent: Agent, memories: Memory[], agents: Agent[]) {
  const nameMap = new Map(agents.map(a => [a.id, a.bio.name]))
  const getName = (id: string) => nameMap.get(id) ?? 'кто-то'

  const memoryText = memories
    .map(m => {
      const people = m.involvedAgents.map(id => getName(id)).join(', ')
      const text = m.narrativeSummary ?? m.content
      return `- ${text}${people ? ` (участники: ${people})` : ''}`
    })
    .join('\n')

  const system = buildAgentSystemPrompt(agent)

  const user = `Ты ${agent.bio.name}. Вот что произошло за последнее время:

${memoryText}

Подумай и напиши 1-2 предложения от первого лица — что ты понял(а), заметил(а), решил(а).
Это твой внутренний вывод, инсайт. Не пересказывай события, а сделай ВЫВОД.
Примеры хороших рефлексий:
- "Руслан постоянно пытается доминировать, но Тимур его обыгрывает. Мне нужны союзники."
- "Кажется, Настя — единственная, кому я могу доверять. Остальные играют."
- "Я слишком много показываю свои эмоции. Надо быть осторожнее."

Только текст рефлексии, без кавычек и пояснений.`

  return [
    { role: 'system' as const, content: system },
    { role: 'user' as const, content: user },
  ]
}

export async function generateReflection(
  agent: Agent,
  memoryStore: MemoryStore,
  sinceTick: number,
  agents: Agent[],
  currentTick: number,
): Promise<string | null> {
  const memories = memoryStore.getMemoriesSince(agent.id, sinceTick)
    .filter(m => m.type !== 'reflection' && m.importance >= 3)
    .slice(-15)

  if (memories.length < 3) return null // not enough to reflect on

  try {
    const prompt = buildReflectionPrompt(agent, memories, agents)
    const response = await llmGenerate(prompt, 'cheap')
    let reflection = stripThinking(response.content).trim()

    // Clean up: remove quotes if wrapped
    reflection = reflection.replace(/^["«]|["»]$/g, '').trim()

    if (reflection.length < 10 || reflection.length > 300) return null

    // Store as high-importance reflection memory
    memoryStore.addMemory(
      agent.id,
      currentTick,
      'reflection',
      reflection,
      8, // high importance
      [],
      agent.location,
      false,
      undefined,
      undefined,
      reflection, // narrativeSummary = reflection itself
    )

    console.log(`[Reflection] ${agent.bio.name}: ${reflection}`)
    return reflection
  } catch (error) {
    console.warn(`[Reflection] Failed for ${agent.bio.name}:`, error)
    return null
  }
}
