import {
  Agent, Conversation, ConversationMessage, Mood,
} from '../types'
import { MemoryStore } from '../memory/memoryStore'
import { RelationshipGraph } from '../relationships/graph'
import { llmGenerate } from '../llm/provider'
import { buildConversationPrompt, stripThinking } from '../llm/promptBuilder'
import { calculateImportance, EventCategory } from '../memory/importance'
import { nanoid } from 'nanoid'

const MAX_CONVERSATION_TURNS = 8
const MAX_ACTIVE_CONVERSATIONS = 10

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
    useLLM = true
  ): Promise<ConversationMessage | null> {
    if (conv.endedAtTick !== null) return null

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

    if (useLLM) {
      try {
        const recentMemories = memoryStore.getRecentMemories(speaker.id, 5)
        const relationship = relationshipGraph.get(speaker.id, otherAgent.id)

        const prompt = buildConversationPrompt(
          speaker, otherAgent, conv, recentMemories, relationship,
          conv.topic ?? 'обычный разговор'
        )
        const response = await llmGenerate(prompt, 'strong')
        content = stripThinking(response.content)

        // Check for exit signal
        if (content.includes('[УХОДИТ]')) {
          content = content.replace('[УХОДИТ]', '').trim()
          this.endConversation(conv.id, tick)
        }

        // Extract action from asterisks
        const actionMatch = content.match(/\*([^*]+)\*/)
        if (actionMatch) {
          action = actionMatch[1]
        }
      } catch (error) {
        console.warn(`LLM conversation failed for ${speaker.bio.name}:`, error)
        content = generateFallbackDialogue(speaker, otherAgent)
      }
    } else {
      content = generateFallbackDialogue(speaker, otherAgent)
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

  getAgentConversation(agentId: string): Conversation | null {
    return this.getActiveConversations().find(
      c => c.participants.includes(agentId)
    ) ?? null
  }
}

function generateFallbackDialogue(speaker: Agent, other: Agent): string {
  const lines: Record<string, string[]> = {
    'Альфа-самец': ['Слушай, я тут главный, понял?', 'Ты кто такой вообще?', 'Я тебе сейчас объясню как тут дела делаются.'],
    'Тихий стратег': ['Интересная ситуация складывается...', 'Я просто наблюдаю.', 'Знаешь, в покере это называется блеф.'],
    'Королева драмы': ['Вы не понимаете, мне БОЛЬНО!', 'Я не могу так больше!', 'Это предательство!'],
    'Роковая красотка': ['Ну, и кто тут хочет поговорить?', 'Мальчики, мальчики...', 'Я привыкла получать то, что хочу.'],
    'Правильная': ['Это просто неприемлемо!', 'Нужно быть честными друг с другом.', 'Я считаю, что мы должны поговорить.'],
    'Наивная': ['Ой, а так можно было?', 'Я не хочу ни с кем ссориться...', 'А мой кот бы тут всё уладил.'],
    'Бунтарь': ['Вы все тут ненастоящие!', 'Система нас ломает, чуваки.', 'Я на спор сюда пришёл, и я тут останусь.'],
    'Философ-тролль': ['Интересненько...', 'А вот это уже эксперимент.', 'Я просто наблюдаю за человеческой природой.'],
  }

  const pool = lines[speaker.archetype] ?? ['Привет.', 'Ну, как дела?', 'Что думаешь?']
  return pool[Math.floor(Math.random() * pool.length)]
}
