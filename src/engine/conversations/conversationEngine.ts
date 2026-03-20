import {
  Agent, Conversation, ConversationMessage, GameClock, Mood, VulnerabilityTrigger,
} from '../types'
import { MemoryStore } from '../memory/memoryStore'
import { RelationshipGraph } from '../relationships/graph'
import { llmGenerate, isLLMAvailable } from '../llm/provider'
import { LLMCallPriority } from '../llm/budgetTracker'
import { buildConversationPrompt, stripThinking } from '../llm/promptBuilder'
import { applyEmotionalImpact } from '../agents/personality'
import { calculateImportance, EventCategory } from '../memory/importance'
import { nanoid } from 'nanoid'

const MAX_CONVERSATION_TURNS = 8
const MAX_ACTIVE_CONVERSATIONS = 10
const MIN_TICKS_BETWEEN_MESSAGES = 3 // minimum 3 ticks (~30 game min) between messages in same conversation
const MAX_MESSAGE_LENGTH = 200 // characters

// Keywords that increase tension
const TENSION_KEYWORDS = /предатель|лжец|ненавижу|пошёл|ублюд|сволочь|врёшь|заткнись|кричит|орёт|бьёт|угрожа/i

export class ConversationEngine {
  private conversations: Map<string, Conversation> = new Map()

  getActiveConversations(): Conversation[] {
    return [...this.conversations.values()].filter(c => c.endedAtTick === null)
  }

  getConversation(id: string): Conversation | null {
    return this.conversations.get(id) ?? null
  }

  getAllConversations(): Conversation[] {
    return [...this.conversations.values()]
  }

  startConversation(
    initiator: Agent,
    target: Agent,
    tick: number,
    context: string
  ): Conversation {
    // Check if already in conversation
    const existing = this.getActiveConversations().find(
      c => c.participants.includes(initiator.id) && c.participants.includes(target.id)
    )
    if (existing) return existing

    // Limit active conversations
    const active = this.getActiveConversations()
    if (active.length >= MAX_ACTIVE_CONVERSATIONS) {
      const oldest = active.sort((a, b) => a.startedAtTick - b.startedAtTick)[0]
      if (oldest) this.endConversation(oldest.id, tick)
    }

    const conv: Conversation = {
      id: nanoid(),
      participants: [initiator.id, target.id],
      location: initiator.location,
      messages: [],
      startedAtTick: tick,
      endedAtTick: null,
      topic: context,
      isPrivate: initiator.location === 'bedroom' || initiator.location === 'confessional',
      tension: 0,
    }
    this.conversations.set(conv.id, conv)
    return conv
  }

  endConversation(convId: string, tick: number) {
    const conv = this.conversations.get(convId)
    if (conv) {
      conv.endedAtTick = tick
    }
  }

  async progressConversation(
    conv: Conversation,
    agents: Agent[],
    tick: number,
    memoryStore: MemoryStore,
    relationshipGraph: RelationshipGraph,
    useLLM = true,
    clock?: GameClock,
  ): Promise<ConversationMessage | null> {
    if (conv.endedAtTick !== null) return null

    // Cooldown: don't generate messages too fast
    const lastMsgTick = conv.messages.length > 0 ? conv.messages[conv.messages.length - 1].tick : conv.startedAtTick
    if (tick - lastMsgTick < MIN_TICKS_BETWEEN_MESSAGES) return null

    // Dynamic turn limits: high tension allows more turns
    const maxTurns = (conv.tension ?? 0) > 5 ? 12 : MAX_CONVERSATION_TURNS

    // End early if boring
    if (conv.messages.length >= 4 && (conv.tension ?? 0) < 2) {
      this.endConversation(conv.id, tick)
      return null
    }

    if (conv.messages.length >= maxTurns) {
      this.endConversation(conv.id, tick)
      return null
    }

    // Determine whose turn it is (alternating)
    const lastSpeaker = conv.messages.length > 0
      ? conv.messages[conv.messages.length - 1].agentId
      : null
    const speakerId = lastSpeaker === conv.participants[0]
      ? conv.participants[1]
      : conv.participants[0]

    const speaker = agents.find(a => a.id === speakerId)
    const otherAgent = agents.find(a => a.id !== speakerId && conv.participants.includes(a.id))
    if (!speaker || !otherAgent) return null

    let content: string
    let action: string | undefined

    if (useLLM && isLLMAvailable(LLMCallPriority.CONVERSATION)) {
      try {
        const recentMemories = memoryStore.getRecentMemories(speaker.id, 5)
        const relationship = relationshipGraph.get(speaker.id, otherAgent.id)

        const prompt = buildConversationPrompt(
          speaker, otherAgent, conv, recentMemories, relationship,
          conv.topic ?? 'обычный разговор',
          memoryStore, agents, clock
        )
        const response = await llmGenerate(prompt, 'cheap', LLMCallPriority.CONVERSATION)
        content = stripThinking(response.content)

        // Check for exit signal
        if (content.includes('[УХОДИТ]')) {
          content = content.replace('[УХОДИТ]', '').trim()
          this.endConversation(conv.id, tick)
        }

        // Strip ALL asterisk descriptions
        content = content.replace(/\*[^*]+\*/g, '').replace(/\s{2,}/g, ' ').trim()

        // Limit message length
        if (content.length > MAX_MESSAGE_LENGTH) {
          content = content.slice(0, MAX_MESSAGE_LENGTH).replace(/\s\S*$/, '') + '...'
        }
      } catch (error) {
        console.warn(`LLM conversation failed for ${speaker.bio.name}:`, error)
        content = generateFallbackDialogue(speaker, otherAgent)
      }
    } else {
      content = generateFallbackDialogue(speaker, otherAgent)
    }

    // Prevent duplicate messages — if content matches last message, regenerate or skip
    const lastMsg = conv.messages[conv.messages.length - 1]
    if (lastMsg && lastMsg.content === content) {
      // Try one more fallback with different phrase
      content = generateFallbackDialogue(speaker, otherAgent)
      if (lastMsg.content === content) return null // skip if still duplicate
    }

    const message: ConversationMessage = {
      agentId: speaker.id,
      content,
      tick,
      emotion: speaker.emotions.currentMood,
      action,
    }

    conv.messages.push(message)

    // Update tension
    this.updateTension(conv, speaker, otherAgent)

    // Classify conversation importance
    const category = this.classifyConversation(content, conv.tension ?? 0, speaker)
    const importance = calculateImportance(category, {
      emotionalIntensity: Math.max(speaker.emotions.anger, speaker.emotions.excitement),
    })

    // Build narrative memory instead of raw quote
    const emotionalContext = speaker.emotions.anger > 50 ? 'Чувствовал(а) злость'
      : speaker.emotions.sadness > 50 ? 'Было грустно'
      : speaker.emotions.excitement > 60 ? 'Было волнительно'
      : undefined

    const speakerMemory = `Сказал(а) ${otherAgent.bio.name}: "${content.slice(0, 100)}"`
    const listenerMemory = `${speaker.bio.name} сказал(а): "${content.slice(0, 100)}"`

    memoryStore.addMemory(
      speaker.id, tick, 'conversation',
      speakerMemory, importance, [otherAgent.id], conv.location,
      false, undefined, emotionalContext,
    )
    memoryStore.addMemory(
      otherAgent.id, tick, 'conversation',
      listenerMemory, importance, [speaker.id], conv.location,
      false, undefined, emotionalContext,
    )

    // Check vulnerability triggers on the listener
    this.checkVulnerabilityTriggers(content, otherAgent, speaker, memoryStore, tick, conv)

    return message
  }

  private updateTension(conv: Conversation, speaker: Agent, other: Agent) {
    let delta = 0

    // Check last message for tension keywords
    const lastMsg = conv.messages[conv.messages.length - 1]
    if (lastMsg && TENSION_KEYWORDS.test(lastMsg.content)) {
      delta += 2
    }

    // Anger increases tension
    if (speaker.emotions.anger > 60) delta += 1
    if (other.emotions.anger > 60) delta += 0.5

    // Calm messages decrease tension slightly
    if (delta === 0 && conv.messages.length > 2) {
      delta -= 0.3
    }

    conv.tension = Math.max(0, Math.min(10, (conv.tension ?? 0) + delta))
  }

  private classifyConversation(
    content: string,
    tension: number,
    speaker: Agent,
  ): EventCategory {
    if (tension > 6 || /кричит|орёт|удар|угрожа/i.test(content)) return 'argument'
    if (/люблю|поцелу|обним|нравишься/i.test(content)) return 'romantic'
    if (/предатель|врёшь|обманул/i.test(content)) return 'betrayal'
    if (/прости|извини|виноват/i.test(content) && speaker.emotions.sadness > 40) return 'confession'
    return 'casual_chat'
  }

  private checkVulnerabilityTriggers(
    content: string,
    listener: Agent,
    speaker: Agent,
    memoryStore: MemoryStore,
    tick: number,
    conv: Conversation,
  ) {
    const triggers = listener.bio.vulnerabilityTriggers
    if (!triggers?.length) return

    const contentLower = content.toLowerCase()
    for (const trigger of triggers) {
      const matched = trigger.keywords.some(kw => contentLower.includes(kw.toLowerCase()))
      if (matched) {
        // Apply emotional impact
        const impact: Record<string, number> = { [trigger.emotion]: trigger.intensity }
        listener.emotions = applyEmotionalImpact(listener.emotions, impact)

        // Set active vulnerability flag
        listener.activeVulnerability = trigger.behavioralShift

        // High-importance memory
        const matchedKeyword = trigger.keywords.find(kw => contentLower.includes(kw.toLowerCase()))
        memoryStore.addMemory(
          listener.id, tick, 'emotion',
          `${speaker.bio.name} задел(а) больное место ("${matchedKeyword}"). ${trigger.behavioralShift}`,
          8,
          [speaker.id],
          conv.location,
          false, undefined,
          `Уязвимость задета: ${trigger.behavioralShift}`,
        )

        // Increase tension
        conv.tension = Math.min(10, (conv.tension ?? 0) + 3)

        console.log(`[Vulnerability] ${listener.bio.name} triggered by "${matchedKeyword}" from ${speaker.bio.name}`)
        break // only one trigger per message
      }
    }
  }

  getAgentConversation(agentId: string): Conversation | null {
    return this.getActiveConversations().find(
      c => c.participants.includes(agentId)
    ) ?? null
  }

  /** Serialize for persistence */
  toJSON(): Conversation[] {
    return [...this.conversations.values()]
  }

  /** Load from save data */
  loadData(conversations: Conversation[]) {
    this.conversations.clear()
    for (const conv of conversations) {
      this.conversations.set(conv.id, conv)
    }
  }
}

// Track last used fallback per agent to avoid immediate repeats
const lastFallback = new Map<string, string>()

function generateFallbackDialogue(speaker: Agent, other: Agent): string {
  const name = other.bio.name
  const lines: Record<string, string[]> = {
    'Альфа-самец': [
      `${name}, я тут не для разговоров — я для дела.`,
      'Короче, слушай сюда, я два раза повторять не буду.',
      'Ты думаешь, это шутки? Нет, это серьёзно.',
      `Ну давай, ${name}, удиви меня.`,
      'Я тут единственный кто реально что-то делает.',
      'Хватит болтать, давай к делу.',
      'Ну и что дальше?',
      `Слышь, ${name}, я тебя предупреждаю — со мной лучше не шутить.`,
      'Тут нужен лидер, и это точно не ты.',
      'Ладно, продолжай... я слушаю.',
    ],
    'Тихий стратег': [
      'Любопытный ход...',
      'Видишь ли, всё это не случайно.',
      `А ты замечал, ${name}, как тут все друг за другом наблюдают?`,
      'Нет, ты продолжай. Я внимательно слушаю.',
      'Мне кажется, тут есть второе дно.',
      'Давай просто подождём и посмотрим что будет.',
      'Ты сейчас даже не представляешь, насколько это важно.',
      'Хм... не то чтобы я удивлён.',
      `${name}, ты когда-нибудь задумывался — кто тут кого на самом деле контролирует?`,
      'Я это запомню.',
    ],
    'Королева драмы': [
      `${name}, ты вообще понимаешь через что я прохожу?!`,
      'Всё, я больше не могу делать вид что всё нормально!',
      `Нет, ${name}, ты послушай МЕНЯ!`,
      'Почему никто в этом доме не видит что я чувствую?!',
      'Это невыносимо!',
      `Знаешь что, ${name}? Я устала от этих игр!`,
      'Мне так одиноко тут...',
      'НИКТО в этом доме меня не ценит, вот что я тебе скажу!',
      `${name}, даже не начинай.`,
      'Я тут одна нормальная, клянусь!',
    ],
    'Роковая красотка': [
      `${name}, ты такой забавный, когда нервничаешь.`,
      'Ну что, будем разговаривать или просто смотреть друг на друга?',
      `${name}, мне нравится как ты думаешь.`,
      'Я знаю чего хочу. Вопрос — знаешь ли ты?',
      'Может быть, может быть...',
      `${name}, ты правда думаешь что это сработает?`,
      'Мне тут скучно. Развлеки меня.',
      'Как интересно...',
      `Знаешь, ${name}, ты не такой как все тут.`,
      'Посмотрим.',
    ],
    'Правильная': [
      `${name}, давай поговорим нормально, без этого цирка.`,
      'Я считаю, здесь нужны правила, которые все будут соблюдать.',
      `${name}, это важный вопрос.`,
      'Нельзя просто закрывать глаза на то что тут происходит.',
      'Мне кажется, нам всем стоит быть честнее.',
      `${name}, ты так не считаешь?`,
      'Нет, подожди, я хочу разобраться.',
      'Есть вещи, которые просто нельзя игнорировать.',
      `Я не против конфликтов, ${name}, но они должны быть конструктивными.`,
      'Нет, это не нормально.',
    ],
    'Наивная': [
      `${name}, а ты серьёзно?!`,
      'Ой... я даже не знала что так бывает.',
      `${name}, а это не опасно?`,
      'Мне мама говорила — если не знаешь что сказать, лучше улыбайся.',
      'Ну ты даёшь!',
      `${name}, а ты тут давно? Я ещё не привыкла...`,
      'Ой, я, кажется, чего-то не понимаю...',
      'Ну... наверное, ты прав.',
      `А можно я спрошу глупый вопрос, ${name}?`,
      'Тут все такие... взрослые.',
    ],
    'Бунтарь': [
      `${name}, ты реально в это веришь?`,
      'Тут все носят маски, и я единственный кто это видит.',
      `Слушай, ${name}, давай без этих светских бесед, а?`,
      'Опять эта ваша показуха.',
      'Я тут не для того чтобы кому-то нравиться.',
      `${name}, ты тоже играешь или ты настоящий?`,
      'Меня этими штучками не проведёшь.',
      'Мне вообще плевать что вы думаете.',
      `Знаешь что, ${name}? Я скажу прямо — мне тут не нравится.`,
      'Правда глаза колет, да?',
    ],
    'Философ-тролль': [
      `${name}, а ты задумывался о смысле этого разговора?`,
      'Как говорил один умный человек... впрочем, неважно.',
      `Знаете что, ${name}, в каком-то смысле мы все тут подопытные.`,
      'Восхитительно. Абсолютно восхитительно.',
      'Я тут для наблюдений, а вы все — мой эксперимент.',
      `${name}, ты когда-нибудь думал, что реальность — это шоу?`,
      'Продолжай, это ценный материал.',
      'Ницше бы заплакал, если бы видел эту ситуацию.',
      `А вот скажи мне, ${name}, зачем ты тут? Нет, по-настоящему?`,
      'Вы все такие предсказуемые.',
    ],
  }

  const pool = lines[speaker.archetype] ?? [
    `${name}, что скажешь?`, `Интересно получается, ${name}.`,
    'Ну давай, продолжай.', 'Хм, я подумаю.',
  ]

  // Avoid repeating the last phrase
  const lastUsed = lastFallback.get(speaker.id)
  const filtered = lastUsed ? pool.filter(l => l !== lastUsed) : pool
  const chosen = (filtered.length > 0 ? filtered : pool)[Math.floor(Math.random() * (filtered.length > 0 ? filtered : pool).length)]
  lastFallback.set(speaker.id, chosen)
  return chosen
}
