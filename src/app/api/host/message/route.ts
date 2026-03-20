import { NextRequest, NextResponse } from 'next/server'
import { getSimulation } from '../../../../engine/simulationManager'
import type { Mood } from '../../../../engine/types'

function tryGetLLM(): import('../../../../engine/types').LLMProvider | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { getLLMProvider } = require('../../../../engine/llm/provider')
    return getLLMProvider()
  } catch {
    return null
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { targetAgentId, message, broadcast, type: msgType } = body as {
      targetAgentId?: string
      message: string
      broadcast?: boolean
      type?: 'message' | 'task' | 'twist'
    }

    if (!message?.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 })
    }

    const sim = getSimulation()
    const { agents, clock } = sim.state
    const tick = clock.tick

    // Determine target agents
    const targets = broadcast || !targetAgentId
      ? agents.filter(a => !a.isEvicted && a.status !== 'sleeping')
      : agents.filter(a => a.id === targetAgentId && !a.isEvicted)

    if (targets.length === 0) {
      return NextResponse.json({ error: 'No valid targets' }, { status: 400 })
    }

    // Handle twist type — modify simulation state
    if (msgType === 'twist') {
      if (message.includes('вернуть всех') || message.includes('вернём всех')) {
        sim.applyTwist('return_all', {})
      } else if (message.includes('иммунитет') && targetAgentId) {
        sim.applyTwist('immunity', { agentId: targetAgentId })
      } else if (message.includes('секрет')) {
        sim.applyTwist('secret_reveal', { message })
      } else {
        // Generic twist — broadcast as drama alert and let agents respond
        sim.applyTwist('secret_reveal', { message })
      }
    }

    // Handle task type — override agent's current plan
    if (msgType === 'task' && targetAgentId) {
      const targetAgent = agents.find(a => a.id === targetAgentId)
      if (targetAgent) {
        targetAgent.currentPlan = {
          agentId: targetAgentId,
          day: clock.day,
          goals: [message],
        }
      }
    }

    const llm = tryGetLLM()
    const responses: Array<{ agentId: string; name: string; response: string; emotion: Mood }> = []

    for (const agent of targets) {
      let responseText: string
      let emotion: Mood = agent.emotions.currentMood

      if (llm) {
        try {
          const systemPrompt = `Ты ${agent.bio.name} ${agent.bio.surname}, участник реалити-шоу "Дом-2".
Возраст: ${agent.bio.age}. Архетип: ${agent.archetype}.
${agent.bio.physicalDescription}
Занятие: ${agent.bio.occupation}. Цель: ${agent.bio.lifeGoal}.
Коронная фраза: "${agent.bio.catchphrase}"
Текущее настроение: ${agent.emotions.currentMood}. Энергия: ${Math.round(agent.energy)}%.

Ведущий обращается к тебе. Ответь в характере своего персонажа.
Ответ — 1-3 предложения, разговорный русский.
В конце на отдельной строке укажи эмоцию в формате [MOOD:emotion], где emotion одно из: happy, angry, sad, excited, jealous, flirty, bored, anxious, neutral, annoyed, devastated, euphoric, scheming`

          const result = await llm.generate(
            [
              { role: 'system', content: systemPrompt },
              { role: 'user', content: `Ведущий говорит: "${message}"` },
            ],
            'cheap'
          )

          responseText = result.content

          // Extract mood tag
          const moodMatch = responseText.match(/\[MOOD:(\w+)\]/)
          if (moodMatch) {
            emotion = moodMatch[1] as Mood
            responseText = responseText.replace(/\[MOOD:\w+\]/, '').trim()
          }
        } catch {
          responseText = getFallbackResponse(agent.archetype, message)
        }
      } else {
        responseText = getFallbackResponse(agent.archetype, message)
      }

      responses.push({
        agentId: agent.id,
        name: agent.bio.name,
        response: responseText,
        emotion,
      })

      // Emit SSE events so they appear in the chat
      sim.emit({
        type: 'conversation',
        data: {
          speakerName: agent.bio.name,
          speakerId: agent.id,
          content: responseText,
          emotion,
          action: 'отвечает ведущему',
          location: agent.location,
        },
        tick,
      })
    }

    // Drama alert
    const targetName = targets.length === 1 ? targets[0].bio.name : 'всем'
    sim.emit({
      type: 'drama_alert',
      data: { message: `[ВЕДУЩИЙ] обратился к ${targetName}!` },
      tick,
    })

    return NextResponse.json({ responses })
  } catch (error) {
    console.error('[API] host/message error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}

function getFallbackResponse(archetype: string, _message: string): string {
  const responses: Record<string, string[]> = {
    'Альфа-самец': ['Понял, шеф. Будет сделано!', 'Я тут главный, но ладно, слушаю.', 'Хорошо, принято.'],
    'Тихий стратег': ['Интересно... Я подумаю над этим.', 'Спасибо за информацию, учту.', 'Хм, любопытный поворот.'],
    'Королева драмы': ['О боже, это так волнительно!', 'Наконец-то хоть кто-то обратил внимание!', 'Ну конечно, как всегда...'],
    'Роковая красотка': ['Мм, как скажете...', 'Ну, если вы так хотите...', 'Принято, дорогой ведущий.'],
    'Правильная': ['Конечно, я всё поняла.', 'Хорошо, буду следовать правилам.', 'Спасибо за разъяснение!'],
    'Наивная': ['Ой, правда?! Как интересно!', 'Хорошо-хорошо, я постараюсь!', 'Вау, спасибо!'],
    'Бунтарь': ['Ну допустим... Посмотрим.', 'А если я не согласен?', 'Ладно, но я это не одобряю.'],
    'Философ-тролль': ['Забавно. Очень забавно.', 'А вы уверены, что это мудрое решение?', 'Ну что ж, бытие определяет сознание...'],
  }
  const options = responses[archetype] ?? ['Понял.', 'Хорошо.', 'Принято.']
  return options[Math.floor(Math.random() * options.length)]
}
