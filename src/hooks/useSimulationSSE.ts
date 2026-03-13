'use client'

import { useEffect, useRef } from 'react'
import { useSimulationStore } from '../store/simulationStore'
import type { SSEEvent, Mood, LocationId } from '../engine/types'

// Set to true to use mock data instead of connecting to the server
const USE_MOCK = false

// ─── Mock agent definitions ──────────────────────────────────

const LOCATIONS: LocationId[] = ['yard', 'bedroom', 'living_room', 'kitchen', 'confessional']
const MOODS: Mood[] = ['happy', 'angry', 'sad', 'excited', 'jealous', 'flirty', 'bored', 'anxious', 'neutral', 'annoyed', 'scheming']

const LOCATION_POSITIONS: Record<LocationId, { x: number; y: number }> = {
  yard: { x: 160, y: 40 },
  bedroom: { x: 40, y: 130 },
  living_room: { x: 160, y: 130 },
  kitchen: { x: 260, y: 130 },
  confessional: { x: 160, y: 210 },
}

interface MockAgent {
  id: string
  name: string
  location: LocationId
  mood: Mood
  energy: number
  status: string
}

const INITIAL_AGENTS: MockAgent[] = [
  { id: 'a1', name: 'Тимур', location: 'living_room', mood: 'neutral', energy: 80, status: 'free' },
  { id: 'a2', name: 'Марина', location: 'kitchen', mood: 'happy', energy: 65, status: 'free' },
  { id: 'a3', name: 'Дима', location: 'yard', mood: 'excited', energy: 90, status: 'free' },
  { id: 'a4', name: 'Кристина', location: 'yard', mood: 'flirty', energy: 70, status: 'free' },
  { id: 'a5', name: 'Руслан', location: 'bedroom', mood: 'bored', energy: 40, status: 'free' },
  { id: 'a6', name: 'Олег', location: 'confessional', mood: 'anxious', energy: 55, status: 'free' },
  { id: 'a7', name: 'Алёна', location: 'living_room', mood: 'happy', energy: 75, status: 'free' },
  { id: 'a8', name: 'Настя', location: 'yard', mood: 'scheming', energy: 60, status: 'free' },
]

// ─── Conversation templates ──────────────────────────────────

const CONVOS: Array<{
  participants: [string, string]
  location: LocationId
  lines: Array<{ speaker: 0 | 1; text: string; emotion: Mood; action?: string }>
}> = [
  {
    participants: ['a3', 'a4'], location: 'yard',
    lines: [
      { speaker: 0, text: 'Кристина, а ты вообще зачем сюда пришла?', emotion: 'excited' },
      { speaker: 1, text: 'А ты как думаешь? Может, из-за тебя...', emotion: 'flirty', action: 'улыбается' },
      { speaker: 0, text: 'Ну ты даёшь! А если серьёзно?', emotion: 'happy', action: 'смеётся' },
      { speaker: 1, text: 'Серьёзно? Хочу понять, на что я способна.', emotion: 'excited' },
    ],
  },
  {
    participants: ['a1', 'a7'], location: 'living_room',
    lines: [
      { speaker: 0, text: 'Алёна, ты заметила как Руслан себя ведёт?', emotion: 'scheming' },
      { speaker: 1, text: 'Заметила. Он явно что-то скрывает.', emotion: 'anxious' },
      { speaker: 0, text: 'Думаю, нам надо быть осторожнее.', emotion: 'neutral' },
      { speaker: 1, text: 'Согласна. Давай следить за ним?', emotion: 'scheming', action: 'понижает голос' },
    ],
  },
  {
    participants: ['a2', 'a5'], location: 'kitchen',
    lines: [
      { speaker: 0, text: 'Руслан, есть хочешь? Я борщ сварила.', emotion: 'happy' },
      { speaker: 1, text: 'О, борщ! Это меняет дело.', emotion: 'excited', action: 'садится за стол' },
      { speaker: 0, text: 'Вот, попробуй. Рецепт бабушкин.', emotion: 'happy', action: 'наливает борщ' },
      { speaker: 1, text: 'Марина, ты лучшая повариха тут!', emotion: 'happy' },
    ],
  },
  {
    participants: ['a8', 'a4'], location: 'yard',
    lines: [
      { speaker: 0, text: 'Кристина, можно тебя на минутку?', emotion: 'scheming' },
      { speaker: 1, text: 'Конечно, что случилось?', emotion: 'neutral' },
      { speaker: 0, text: 'Ты доверяешь Диме? Мне кажется он играет...', emotion: 'scheming', action: 'оглядывается' },
      { speaker: 1, text: 'Что?! Почему ты так думаешь?', emotion: 'angry' },
      { speaker: 0, text: 'Просто наблюдаю. Будь осторожна.', emotion: 'neutral', action: 'пожимает плечами' },
    ],
  },
  {
    participants: ['a6', 'a6'], location: 'confessional',
    lines: [
      { speaker: 0, text: 'Я не знаю, зачем я здесь. Все такие фальшивые.', emotion: 'sad' },
      { speaker: 0, text: 'Тимур строит из себя лидера, Настя шепчется за спиной...', emotion: 'annoyed' },
      { speaker: 0, text: 'Единственная нормальная — Марина. Хотя бы готовить умеет.', emotion: 'neutral', action: 'вздыхает' },
    ],
  },
  {
    participants: ['a3', 'a1'], location: 'living_room',
    lines: [
      { speaker: 0, text: 'Тимур, давай начистоту. Ты за кого на голосовании?', emotion: 'excited' },
      { speaker: 1, text: 'Пока не решил. А ты что, уже коалицию собираешь?', emotion: 'scheming' },
      { speaker: 0, text: 'Не коалицию. Просто хочу знать, кому доверять.', emotion: 'neutral' },
      { speaker: 1, text: 'Справедливо. Давай поговорим после ужина.', emotion: 'neutral', action: 'кивает' },
    ],
  },
  {
    participants: ['a7', 'a2'], location: 'kitchen',
    lines: [
      { speaker: 0, text: 'Марина, научи меня готовить! Я даже яичницу жгу.', emotion: 'happy', action: 'смеётся' },
      { speaker: 1, text: 'Ахаха, ладно! Начнём с простого — салат.', emotion: 'happy' },
      { speaker: 0, text: 'Салат — это нарезать и перемешать, верно?', emotion: 'excited' },
      { speaker: 1, text: 'Ну... в целом да. Но есть нюансы!', emotion: 'happy', action: 'достаёт овощи' },
    ],
  },
  {
    participants: ['a5', 'a3'], location: 'yard',
    lines: [
      { speaker: 0, text: 'Дима, тебе не кажется что Настя стрёмная?', emotion: 'annoyed' },
      { speaker: 1, text: 'Стрёмная? Она просто тихая.', emotion: 'neutral' },
      { speaker: 0, text: 'Тихие — самые опасные. Поверь мне.', emotion: 'scheming', action: 'сплёвывает' },
      { speaker: 1, text: 'Ладно, учту. Но пока она ничего плохого не сделала.', emotion: 'neutral' },
    ],
  },
  {
    participants: ['a4', 'a7'], location: 'bedroom',
    lines: [
      { speaker: 0, text: 'Алёна, можно у тебя спросить кое-что личное?', emotion: 'anxious' },
      { speaker: 1, text: 'Конечно, подруга! Что такое?', emotion: 'happy' },
      { speaker: 0, text: 'Тебе Дима нравится? Только честно.', emotion: 'jealous' },
      { speaker: 1, text: 'Нет-нет, он не в моём типе! Не переживай.', emotion: 'happy', action: 'обнимает' },
      { speaker: 0, text: 'Ладно, верю... Просто Настя мне наговорила всякого.', emotion: 'sad' },
    ],
  },
  {
    participants: ['a1', 'a5'], location: 'living_room',
    lines: [
      { speaker: 0, text: 'Руслан, хватит валяться! Пошли на поляну.', emotion: 'annoyed' },
      { speaker: 1, text: 'Зачем? Там комары и Настя с её интригами.', emotion: 'bored' },
      { speaker: 0, text: 'Затем что ты выглядишь как овощ. Нужно двигаться!', emotion: 'angry', action: 'тянет за руку' },
      { speaker: 1, text: 'Ладно-ладно, иду! Только не ори.', emotion: 'annoyed', action: 'встаёт' },
    ],
  },
]

const DRAMA_ALERTS = [
  'Настя шепчется с Кристиной — заговор?',
  'Руслан и Тимур поспорили на кухне!',
  'Дима и Кристина уединились на поляне...',
  'Олег рассказал камере все секреты!',
  'Алёна плачет в спальне',
  'Марина отказалась готовить — бунт!',
  'Тимур и Дима объединились в альянс',
]

// ─── Mock simulation runner ──────────────────────────────────

function runMock() {
  const store = useSimulationStore.getState()
  const agents = INITIAL_AGENTS.map(a => ({ ...a }))
  let tick = 10
  let convIdx = 0
  let dramaIdx = 0

  store.setConnected(true)

  function getPosition(loc: LocationId, agentIndex: number) {
    const base = LOCATION_POSITIONS[loc]
    const offset = agentIndex * 20
    return { x: base.x + (offset % 60) - 30, y: base.y + Math.floor(offset / 60) * 20 }
  }

  function broadcastState() {
    const hour = 6 + Math.floor((tick % 144) / 6)
    const minute = ((tick % 6) * 10)
    const day = Math.floor(tick / 144) + 1

    store.handleSSEEvent({
      type: 'state_update',
      tick,
      data: {
        clock: {
          tick, day, hour, minute,
          timeOfDay: hour < 12 ? 'morning' : hour < 18 ? 'afternoon' : hour < 22 ? 'evening' : 'night',
          ticksPerGameHour: 6,
        },
        agents: agents.map((a, i) => ({
          ...a,
          position: getPosition(a.location, i),
        })),
        drama: {
          overall: 30 + Math.floor(Math.random() * 40),
          conflicts: Math.floor(Math.random() * 4),
          romances: Math.floor(Math.random() * 3),
          betrayals: Math.floor(Math.random() * 2),
          alliances: Math.floor(Math.random() * 3),
          lastMajorEvent: DRAMA_ALERTS[dramaIdx % DRAMA_ALERTS.length],
          ticksSinceLastDrama: Math.floor(Math.random() * 10),
        },
        activeEvents: [],
      },
    })
  }

  // Initial state
  broadcastState()

  // Run a conversation
  function playConversation() {
    const convo = CONVOS[convIdx % CONVOS.length]
    convIdx++
    const convId = `conv-${tick}-${convIdx}`

    // Move participants to conversation location (if not confessional monologue)
    for (const pid of new Set(convo.participants)) {
      const agent = agents.find(a => a.id === pid)
      if (agent && agent.location !== convo.location) {
        agent.location = convo.location
        store.handleSSEEvent({
          type: 'agent_move',
          tick,
          data: {
            agentId: agent.id,
            name: agent.name,
            location: convo.location,
            position: getPosition(convo.location, agents.indexOf(agent)),
          },
        })
      }
    }

    // Play lines with delays
    convo.lines.forEach((line, i) => {
      setTimeout(() => {
        tick++
        const speakerAgent = agents.find(a => a.id === convo.participants[line.speaker])
        if (!speakerAgent) return

        speakerAgent.mood = line.emotion

        store.handleSSEEvent({
          type: 'conversation',
          tick,
          data: {
            conversationId: convId,
            speakerName: speakerAgent.name,
            speakerId: speakerAgent.id,
            content: line.text,
            emotion: line.emotion,
            action: line.action,
            location: convo.location,
          },
        })

        // Update state after each line
        broadcastState()
      }, (i + 1) * 2500)
    })

    return convo.lines.length * 2500
  }

  // Random agent movement
  function moveRandomAgent() {
    const agent = agents[Math.floor(Math.random() * agents.length)]
    const newLoc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)]
    if (newLoc === agent.location) return

    agent.location = newLoc
    agent.mood = MOODS[Math.floor(Math.random() * MOODS.length)]
    agent.energy = Math.max(10, Math.min(100, agent.energy + Math.floor(Math.random() * 20) - 10))

    store.handleSSEEvent({
      type: 'agent_move',
      tick,
      data: {
        agentId: agent.id,
        name: agent.name,
        location: newLoc,
        position: getPosition(newLoc, agents.indexOf(agent)),
      },
    })
    broadcastState()
  }

  // Drama alert
  function fireDramaAlert() {
    store.handleSSEEvent({
      type: 'drama_alert',
      tick,
      data: { message: DRAMA_ALERTS[dramaIdx % DRAMA_ALERTS.length] },
    })
    dramaIdx++
  }

  // Main loop: alternate conversations, movements, and drama
  let convDuration = playConversation()

  const mainLoop = setInterval(() => {
    tick++

    // 30% chance to move someone
    if (Math.random() < 0.3) moveRandomAgent()

    // 10% chance for drama alert
    if (Math.random() < 0.1) fireDramaAlert()
  }, 5000)

  // Start new conversations periodically
  const convoLoop = setInterval(() => {
    convDuration = playConversation()
  }, 12000)

  return () => {
    clearInterval(mainLoop)
    clearInterval(convoLoop)
  }
}

// ─── Hook ────────────────────────────────────────────────────

export function useSimulationSSE() {
  const handleSSEEvent = useSimulationStore(s => s.handleSSEEvent)
  const setConnected = useSimulationStore(s => s.setConnected)
  const eventSourceRef = useRef<EventSource | null>(null)

  useEffect(() => {
    if (USE_MOCK) {
      return runMock()
    }

    const connect = () => {
      const es = new EventSource('/api/simulation/stream')
      eventSourceRef.current = es

      es.onopen = () => {
        setConnected(true)
      }

      es.onmessage = (e) => {
        try {
          const event: SSEEvent = JSON.parse(e.data)
          handleSSEEvent(event)
        } catch (err) {
          console.warn('Failed to parse SSE event:', err)
        }
      }

      es.onerror = () => {
        setConnected(false)
        es.close()
        setTimeout(connect, 3000)
      }
    }

    connect()

    return () => {
      eventSourceRef.current?.close()
    }
  }, [handleSSEEvent, setConnected])
}
