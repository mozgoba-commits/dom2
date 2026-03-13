import { Agent, Conversation, GameClock, LocationId, Memory, Relationship, LLMMessage } from '../types'
import { formatGameTime } from '../clock'
import { getVoiceProfile } from './voiceProfiles'
import { MemoryStore } from '../memory/memoryStore'
import {
  buildDailySummary,
  buildActiveStorylines,
  buildRelationshipNarrative,
  buildHouseGossip,
} from '../memory/contextBuilder'

// ─── Trait & emotion narrative helpers ────────────────────────

export function traitNarrative(agent: Agent): string {
  const t = agent.traits
  const parts: string[] = []

  if (t.extraversion > 70) parts.push('Ты душа компании, не можешь сидеть один.')
  else if (t.extraversion < 30) parts.push('Ты интроверт, тебе нужно личное пространство.')

  if (t.agreeableness > 70) parts.push('Ты не любишь конфликты и ищешь компромиссы.')
  else if (t.agreeableness < 30) parts.push('Тебе плевать на чужое мнение.')

  if (t.neuroticism > 70) parts.push('Ты эмоционально нестабилен(а), легко заводишься.')
  else if (t.neuroticism < 25) parts.push('Тебя сложно вывести из себя.')

  if (t.manipulativeness > 60) parts.push('Ты умеешь использовать людей и знаешь чужие слабости.')
  if (t.jealousy > 60) parts.push('Ты ревнив(а) — видишь угрозу в каждом, кто приближается к "твоим" людям.')
  if (t.dramaTendency > 70) parts.push('Ты обожаешь драму и скандалы — они дают тебе энергию.')
  if (t.humor > 70) parts.push('Ты постоянно шутишь, иногда неуместно.')
  if (t.stubbornness > 70) parts.push('Ты упёрт(а) как баран — никогда не признаёшь свою неправоту.')
  if (t.sensitivity > 70) parts.push('Ты принимаешь всё близко к сердцу, ранимый(ая) человек.')
  if (t.flirtatiousness > 70) parts.push('Ты флиртуешь автоматически, это твоя привычка.')
  if (t.loyalty > 70) parts.push('Для тебя верность — не пустое слово.')
  else if (t.loyalty < 30) parts.push('Верность для тебя — понятие гибкое.')

  return parts.join(' ')
}

export function emotionNarrative(agent: Agent): string {
  const e = agent.emotions
  const parts: string[] = []

  if (e.anger > 70) parts.push('тебя колотит от злости')
  else if (e.anger > 40) parts.push('ты раздражён(а)')

  if (e.sadness > 70) parts.push('тебе очень плохо, хочется плакать')
  else if (e.sadness > 40) parts.push('на душе тяжело')

  if (e.happiness > 70) parts.push('ты счастлив(а)')
  if (e.excitement > 70) parts.push('тебя переполняет возбуждение')
  if (e.jealousy > 50) parts.push('тебя разъедает ревность')
  if (e.love > 60) parts.push('ты чувствуешь влюблённость')
  if (e.fear > 50) parts.push('тебе страшно')

  if (parts.length === 0) return 'Ты чувствуешь себя нормально.'
  return 'Сейчас ' + parts.join(', ') + '.'
}

export function stripThinking(content: string): string {
  return content.replace(/<thinking>[\s\S]*?<\/thinking>/g, '').trim()
}

// ─── System prompt (character document) ─────────────────────

export function buildAgentSystemPrompt(agent: Agent): string {
  const { bio, archetype } = agent
  const voice = getVoiceProfile(archetype)

  const sections: string[] = []

  // WHO YOU ARE
  sections.push(`КТО ТЫ:
Ты — ${bio.name} ${bio.surname}, ${bio.age} лет, из ${bio.hometown}.
${bio.occupation}. ${bio.education}.
Архетип: ${archetype}.
"${bio.catchphrase}"
${bio.reasonForComing}`)

  // SECRET GOAL
  if (bio.secretGoal) {
    sections.push(`ТАЙНАЯ ЦЕЛЬ (никому не говори напрямую):
${bio.secretGoal}`)
  }

  // HOW YOU SPEAK
  sections.push(`КАК ТЫ ГОВОРИШЬ:
Стиль: ${voice.sentenceStyle}
Регистр: ${voice.formality}
Слова-паразиты: ${voice.fillerWords.join(', ')}
Привычки: ${voice.verbalTics.join(', ')}
Примеры твоих реплик:
${voice.exampleLines.map(l => `- "${l}"`).join('\n')}`)

  // HOW YOU SHOW EMOTIONS
  sections.push(`КАК ТЫ ПРОЯВЛЯЕШЬ ЭМОЦИИ:
Злость: ${voice.emotionStyles.anger}
Радость: ${voice.emotionStyles.joy}
Грусть: ${voice.emotionStyles.sadness}
Ревность: ${voice.emotionStyles.jealousy}
Флирт: ${voice.emotionStyles.flirting}
Страх: ${voice.emotionStyles.fear}`)

  // CHARACTER
  sections.push(`ТВОЙ ХАРАКТЕР:
${traitNarrative(agent)}`)

  // RULES
  sections.push(`ПРАВИЛА:
- Говори ТОЛЬКО от первого лица, как ${bio.name}
- Оставайся В ХАРАКТЕРЕ всегда
- Используй разговорный русский, допустимы сленг и просторечия
- Ответы 1-3 предложения, как в реалити-шоу
- Можешь перебить, сменить тему, быть грубым, промолчать
- РЕАГИРУЙ на то, что сказал собеседник
- Не упоминай что ты ИИ
- Действия в звёздочках: *закатывает глаза*`)

  return sections.join('\n\n')
}

// ─── Decision prompt ─────────────────────────────────────────

export function buildDecisionPrompt(
  agent: Agent,
  clock: GameClock,
  nearbyAgents: Agent[],
  recentMemories: Memory[],
  relationships: Relationship[],
  memoryStore?: MemoryStore,
  allAgents?: Agent[],
): LLMMessage[] {
  const system = buildAgentSystemPrompt(agent)

  const nearbyList = nearbyAgents
    .map(a => {
      const rel = relationships.find(r =>
        (r.agentAId === agent.id && r.agentBId === a.id) ||
        (r.agentAId === a.id && r.agentBId === agent.id)
      )
      const relNote = rel ? ` [отношения: дружба ${rel.friendship}, романтика ${rel.romance}]` : ''
      return `- ${a.bio.name} (${a.archetype})${relNote}`
    })
    .join('\n')

  // Rich context sections
  let dailySummary = ''
  let storylines = ''
  let gossip = ''
  if (memoryStore && allAgents) {
    dailySummary = buildDailySummary(agent.id, memoryStore, clock, allAgents)
    storylines = buildActiveStorylines(relationships, allAgents)
    gossip = buildHouseGossip(agent.id, memoryStore, allAgents)
  }

  const memoryList = recentMemories.slice(-10)
    .map(m => `- ${m.narrativeSummary ?? m.content}`)
    .join('\n')

  const user = `<thinking>
Подумай как ${agent.bio.name}:
- Что я чувствую прямо сейчас?
- Кто мне нужен / от кого хочу держаться подальше?
- Что продвинет мою тайную цель?
- Какой ход будет самым драматичным?
</thinking>

${formatGameTime(clock)}. Локация: ${locationToRussian(agent.location)}.
${emotionNarrative(agent)} Энергия: ${Math.round(agent.energy)}%.

${dailySummary ? `Сегодня: ${dailySummary}\n` : ''}${storylines ? `\n${storylines}\n` : ''}${gossip ? `\n${gossip}\n` : ''}
Рядом:
${nearbyList || '(никого)'}

Помнишь:
${memoryList || '(ничего важного)'}

Что хочешь сделать? СТРОГО JSON:
{
  "action": "move" | "talk" | "flirt" | "argue" | "gossip" | "comfort" | "manipulate" | "avoid" | "rest" | "think" | "confront" | "apologize",
  "targetAgent": "имя или null",
  "targetLocation": "yard" | "bedroom" | "living_room" | "kitchen" | "confessional" | null,
  "reasoning": "краткое объяснение от первого лица",
  "hiddenMotivation": "что ты РЕАЛЬНО хочешь этим добиться",
  "urgency": число от 0 до 10
}`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

// ─── Conversation prompt (critical improvement) ──────────────

export function buildConversationPrompt(
  agent: Agent,
  otherAgent: Agent,
  conversation: Conversation,
  recentMemories: Memory[],
  relationship: Relationship | null,
  context: string,
  memoryStore?: MemoryStore,
  allAgents?: Agent[],
  clock?: GameClock,
): LLMMessage[] {
  const system = buildAgentSystemPrompt(agent)

  const history = conversation.messages.slice(-10)
    .map(m => `${m.agentId === agent.id ? agent.bio.name : otherAgent.bio.name}: ${m.content}`)
    .join('\n')

  // Rich relationship narrative
  let relNarrative = ''
  if (memoryStore && allAgents) {
    relNarrative = buildRelationshipNarrative(
      agent.id, otherAgent.id, relationship, memoryStore, allAgents
    )
  } else if (relationship) {
    relNarrative = `Дружба: ${relationship.friendship}, романтика: ${relationship.romance}, доверие: ${relationship.trust}`
  } else {
    relNarrative = `Ты ещё не знаешь ${otherAgent.bio.name}`
  }

  // Daily summary + gossip for context
  let dailySummary = ''
  let gossip = ''
  if (memoryStore && allAgents && clock) {
    dailySummary = buildDailySummary(agent.id, memoryStore, clock, allAgents)
    gossip = buildHouseGossip(agent.id, memoryStore, allAgents)
  }

  const memories = recentMemories.slice(-5)
    .map(m => `- ${m.narrativeSummary ?? m.content}`)
    .join('\n')

  // Tension indicator
  const tensionNote = (conversation.tension ?? 0) > 5
    ? '\n[НАПРЯЖЕНИЕ НАРАСТАЕТ — конфликт может вспыхнуть!]\n'
    : ''

  const user = `<thinking>
Подумай как ${agent.bio.name}:
- Что только что сказал ${otherAgent.bio.name}? Как я к этому отношусь?
- Что я чувствую прямо сейчас?
- Что я не могу сказать напрямую?
- Какой мой скрытый мотив в этом разговоре?
</thinking>

Ты разговариваешь с ${otherAgent.bio.name} (${otherAgent.archetype}).
${relNarrative}
${emotionNarrative(agent)}
${tensionNote}
Контекст: ${context}
${dailySummary ? `\nСегодня: ${dailySummary}` : ''}${gossip ? `\n${gossip}` : ''}
${memories ? `\nТы помнишь:\n${memories}` : ''}
${history ? `\nДиалог:\n${history}` : ''}

Ответь как ${agent.bio.name}. 1-3 предложения.
Можешь добавить действие: *закатывает глаза*
Можешь перебить, сменить тему, промолчать или нагрубить.
Если хочешь закончить разговор: [УХОДИТ].`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

// ─── Confessional prompt ─────────────────────────────────────

export function buildConfessionalPrompt(
  agent: Agent,
  recentMemories: Memory[],
  relationships: Relationship[],
  allAgents: Agent[],
  memoryStore?: MemoryStore,
  clock?: GameClock,
): LLMMessage[] {
  const voice = getVoiceProfile(agent.archetype)
  const system = buildAgentSystemPrompt(agent) + `

КОНФЕССИОННАЯ — единственное место где ты можешь быть честным.
Стиль внутреннего голоса: ${voice.innerVoice}
Будь искренним. Зрители это любят.`

  const memoryList = recentMemories.slice(-15)
    .map(m => `- ${m.narrativeSummary ?? m.content}`)
    .join('\n')

  let dailySummary = ''
  if (memoryStore && clock) {
    dailySummary = buildDailySummary(agent.id, memoryStore, clock, allAgents)
  }

  const relSummary = relationships
    .map(r => {
      const otherId = r.agentAId === agent.id ? r.agentBId : r.agentAId
      const other = allAgents.find(a => a.id === otherId)
      if (!other) return null
      const feel: string[] = []
      if (r.romance > 40) feel.push('романтика')
      if (r.friendship > 40) feel.push('дружба')
      if (r.rivalry > 40) feel.push('вражда')
      if (r.trust < -20) feel.push('не доверяю')
      if (r.alliance) feel.push('альянс')
      return feel.length > 0 ? `${other.bio.name}: ${feel.join(', ')}` : null
    })
    .filter(Boolean)
    .join('; ')

  const user = `<thinking>
Спроси себя:
- Кто мне реально нравится? Кого я ненавижу?
- Чего я боюсь?
- Какой мой план на ближайшее время?
- О чём я не могу рассказать другим участникам?
</thinking>

Ты в конфессионной. Расскажи камере что ты РЕАЛЬНО думаешь.
${emotionNarrative(agent)}
${dailySummary ? `\nСегодня: ${dailySummary}` : ''}

События:
${memoryList}

Отношения: ${relSummary || 'ещё не сложились'}

2-4 предложения. Будь честным.`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

// ─── Tok-show prompt ────────────────────────────────────────

export function buildTokShowPrompt(
  agent: Agent,
  topic: string,
  previousStatements: { name: string; text: string }[]
): LLMMessage[] {
  const system = buildAgentSystemPrompt(agent) + '\n\nТы на ток-шоу "Поляна". Ведущий задал тему, участники высказываются по очереди. Можешь перебить, поспорить, согласиться.'

  const prev = previousStatements
    .map(s => `${s.name}: ${s.text}`)
    .join('\n')

  const user = `Тема ток-шоу: "${topic}"
${prev ? `\nЧто уже сказали:\n${prev}` : ''}

Твоя очередь. 1-3 предложения. Будь ярким!`

  return [
    { role: 'system', content: system },
    { role: 'user', content: user },
  ]
}

// ─── Conversation opener ────────────────────────────────────

export function buildConversationOpener(
  agent: Agent,
  target: Agent,
  action: string,
  relationship: Relationship | null,
): string {
  const targetName = target.bio.name

  if (action === 'confront' && relationship && relationship.trust < -20) {
    return `Конфронтация с ${targetName} после потери доверия`
  }
  if (action === 'flirt') {
    return `Флирт с ${targetName}`
  }
  if (action === 'gossip') {
    return `Обсуждение слухов с ${targetName}`
  }
  if (action === 'comfort') {
    return `Поддержка ${targetName}`
  }
  if (action === 'manipulate') {
    return `Попытка манипулировать ${targetName}`
  }
  if (action === 'apologize') {
    return `Извинения перед ${targetName}`
  }
  if (action === 'argue') {
    return `Спор с ${targetName}`
  }

  return `Разговор с ${targetName}`
}

// ─── Memory formation prompt (cheap tier) ───────────────────

export function buildMemoryFormationPrompt(
  agentName: string,
  eventDescription: string,
  emotion: string,
): LLMMessage[] {
  return [
    {
      role: 'system',
      content: `Ты помогаешь персонажу ${agentName} сформулировать воспоминание. Преврати описание события в краткое воспоминание от первого лица (1-2 предложения). Добавь эмоциональную окраску. Ответь в формате JSON: {"memory": "текст", "emotionalTag": "anger|hurt|joy|suspicion|tenderness|fear|pride"}`,
    },
    {
      role: 'user',
      content: `Событие: ${eventDescription}\nЭмоциональное состояние: ${emotion}`,
    },
  ]
}

// ─── Helpers ─────────────────────────────────────────────────

function locationToRussian(loc: LocationId): string {
  const map: Record<LocationId, string> = {
    yard: 'Поляна/Двор',
    bedroom: 'Спальня',
    living_room: 'Гостиная',
    kitchen: 'Кухня',
    confessional: 'Конфессионная',
  }
  return map[loc]
}
