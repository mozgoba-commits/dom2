import { Agent, GameEvent } from '../types'
import { RelationshipGraph } from '../relationships/graph'
import { MemoryStore } from '../memory/memoryStore'
import { llmGenerate } from '../llm/provider'
import { buildTokShowPrompt } from '../llm/promptBuilder'

interface TokShowResult {
  topic: string
  statements: { agentId: string; name: string; text: string }[]
}

const TOK_SHOW_TOPICS = [
  'Кто здесь самый неискренний?',
  'Любовь или стратегия — зачем вы на самом деле здесь?',
  'Кого вы бы выселили первым и почему?',
  'Кто за спиной говорит одно, а в лицо — другое?',
  'Есть ли настоящие чувства на проекте?',
  'Мужчины проекта — альфа или тряпки?',
  'Женщины проекта — кто из вас настоящая?',
  'Тайные альянсы — кто с кем и против кого?',
  'Ревность или любовь — где грань?',
  'Кто главный манипулятор на проекте?',
]

/**
 * Generate a tok-show topic based on current drama.
 */
export function pickTokShowTopic(
  agents: Agent[],
  relationships: RelationshipGraph
): string {
  // Try to pick a topic relevant to current conflicts
  const allRels = relationships.getAll()
  const highRivalry = allRels.filter(r => r.rivalry > 50)
  const highRomance = allRels.filter(r => r.romance > 50)

  if (highRivalry.length > 0) {
    const topics = TOK_SHOW_TOPICS.filter(t =>
      t.includes('неискренн') || t.includes('выселил') ||
      t.includes('спин') || t.includes('манипулятор')
    )
    if (topics.length > 0) return topics[Math.floor(Math.random() * topics.length)]
  }

  if (highRomance.length > 0) {
    const topics = TOK_SHOW_TOPICS.filter(t =>
      t.includes('чувств') || t.includes('любов') || t.includes('ревност')
    )
    if (topics.length > 0) return topics[Math.floor(Math.random() * topics.length)]
  }

  return TOK_SHOW_TOPICS[Math.floor(Math.random() * TOK_SHOW_TOPICS.length)]
}

/**
 * Run a full tok-show with all agents speaking in order.
 */
export async function runTokShow(
  event: GameEvent,
  agents: Agent[],
  relationships: RelationshipGraph,
  memoryStore: MemoryStore,
  useLLM = true
): Promise<TokShowResult> {
  const topic = pickTokShowTopic(agents, relationships)
  const participants = agents.filter(
    a => event.involvedAgents.includes(a.id) && !a.isEvicted
  )

  // Randomize speaking order, but put drama-prone first
  const sorted = [...participants].sort((a, b) => {
    return (b.traits.dramaTendency + b.traits.extraversion) -
           (a.traits.dramaTendency + a.traits.extraversion)
  })

  const statements: TokShowResult['statements'] = []

  for (const agent of sorted) {
    let text: string

    if (useLLM) {
      try {
        const prompt = buildTokShowPrompt(agent, topic, statements)
        const response = await llmGenerate(prompt, 'strong')
        text = response.content
      } catch {
        text = generateFallbackTokShowLine(agent, topic)
      }
    } else {
      text = generateFallbackTokShowLine(agent, topic)
    }

    statements.push({
      agentId: agent.id,
      name: agent.bio.name,
      text,
    })

    // Store memory
    memoryStore.addMemory(
      agent.id,
      event.startedAtTick ?? 0,
      'event',
      `На ток-шоу сказал(а): "${text.slice(0, 100)}"`,
      6,
      sorted.map(a => a.id),
      'yard'
    )
  }

  // All participants remember the topic and who said what
  for (const agent of sorted) {
    const othersStatements = statements
      .filter(s => s.agentId !== agent.id)
      .map(s => `${s.name}: "${s.text.slice(0, 50)}"`)
      .join('; ')

    memoryStore.addMemory(
      agent.id,
      event.startedAtTick ?? 0,
      'event',
      `Ток-шоу "${topic}". Другие сказали: ${othersStatements}`,
      7,
      sorted.map(a => a.id),
      'yard'
    )
  }

  return { topic, statements }
}

function generateFallbackTokShowLine(agent: Agent, topic: string): string {
  const lines: Record<string, string> = {
    'Альфа-самец': 'Я скажу прямо — тут все боятся правды, кроме меня!',
    'Тихий стратег': 'Я бы хотел обратить внимание на одну деталь, которую все упускают...',
    'Королева драмы': 'Я не могу молчать! Это касается лично МЕНЯ!',
    'Роковая красотка': 'Ну, мальчики, давайте не будем притворяться...',
    'Правильная': 'Я считаю, что здесь нужно быть честными!',
    'Наивная': 'Мне кажется, все могут помириться, если захотят...',
    'Бунтарь': 'Эта тема — полная чушь, но ладно, скажу!',
    'Философ-тролль': 'Прекрасная тема для социального эксперимента...',
  }
  return lines[agent.archetype] ?? 'Я думаю, что...'
}
