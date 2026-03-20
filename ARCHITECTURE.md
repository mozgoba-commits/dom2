# Архитектура Big Brother AI

## Обзор

Приложение — серверная Next.js-симуляция с клиентским Canvas-рендером. Сервер тикает каждые 5 секунд, вычисляет поведение агентов (решения, диалоги, эмоции, отношения) и стримит результат клиентам через SSE. Клиент рисует пиксель-арт сцену и UI-оверлеи.

```
┌────────────────────────────────────────────────────────────────┐
│                         КЛИЕНТ (React)                         │
│                                                                │
│  ┌──────────┐  ┌────────────┐  ┌──────────┐  ┌─────────────┐  │
│  │ Canvas   │  │ SpeechBub- │  │ ChatPanel│  │  Overlays   │  │
│  │ HouseScene│  │ bles      │  │          │  │ (Tok/Vote/  │  │
│  │ 480×360×3│  │           │  │          │  │  Eviction)  │  │
│  └─────┬────┘  └─────┬─────┘  └────┬─────┘  └──────┬──────┘  │
│        │             │              │               │          │
│  ┌─────┴─────────────┴──────────────┴───────────────┴──────┐  │
│  │              Zustand Stores                              │  │
│  │  simulationStore │ viewStore │ animationStore │ walking  │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │ SSE EventSource                  │
└─────────────────────────────┼──────────────────────────────────┘
                              │
                    GET /api/simulation/stream
                              │
┌─────────────────────────────┼──────────────────────────────────┐
│                         СЕРВЕР (Next.js API Routes)            │
│                             │                                  │
│  ┌──────────────────────────┴───────────────────────────────┐  │
│  │                   SimulationManager                       │  │
│  │                   (синглтон, подписки SSE)                │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                             │                                  │
│  ┌──────────────────────────┴───────────────────────────────┐  │
│  │                     Simulation                            │  │
│  │                 (главный цикл — processTick)              │  │
│  │                                                           │  │
│  │  ┌─────────┐ ┌─────────┐ ┌──────────┐ ┌──────────────┐  │  │
│  │  │ Decision│ │ Conver- │ │ Memory   │ │ Relationship │  │  │
│  │  │ Engine  │ │ sation  │ │ Store    │ │ Graph        │  │  │
│  │  │         │ │ Engine  │ │          │ │              │  │  │
│  │  └────┬────┘ └────┬────┘ └────┬─────┘ └──────┬───────┘  │  │
│  │       │           │           │               │          │  │
│  │  ┌────┴───────────┴───────────┴───────────────┴───────┐  │  │
│  │  │                 LLM Provider                        │  │  │
│  │  │          Claude / OpenAI / Fallback                 │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                │
│  ┌────────────────┐  ┌────────────────┐  ┌─────────────────┐  │
│  │ EventScheduler │  │ VotingEngine   │  │ DramaDetector/  │  │
│  │ (meals, tok,   │  │ (nominations,  │  │ Amplifier       │  │
│  │  sleep, vote)  │  │  tallying)     │  │                 │  │
│  └────────────────┘  └────────────────┘  └─────────────────┘  │
│                                                                │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  Persistence                              │  │
│  │            data/simulation-save.json                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────────────────┘
```

## Структура директорий

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Лендинг (каст участников)
│   ├── show/page.tsx             # Главный экран шоу
│   ├── agents/page.tsx           # Каталог агентов
│   ├── layout.tsx                # Корневой layout
│   └── api/
│       ├── simulation/
│       │   ├── stream/route.ts   # SSE-стрим событий
│       │   └── speed/route.ts    # Управление скоростью
│       ├── agents/
│       │   ├── route.ts          # GET список агентов
│       │   └── [id]/route.ts     # GET один агент
│       ├── host/message/route.ts # Сообщения ведущего
│       ├── vote/route.ts         # Голосование
│       └── relationships/route.ts
│
├── engine/                       # Серверная логика симуляции
│   ├── types.ts                  # Все типы
│   ├── simulation.ts             # Главный класс Simulation
│   ├── simulationManager.ts      # Синглтон + SSE-подписки
│   ├── clock.ts                  # Игровое время
│   ├── coordinates.ts            # Ремаппинг позиций (old→new layout)
│   ├── collisionMap.ts           # Коллизии и walkable-зоны
│   ├── pathfinding.ts            # Маршруты между комнатами
│   ├── persistence.ts            # Сохранение/загрузка состояния
│   ├── audio.ts                  # Звуковые уведомления (Web Audio)
│   │
│   ├── agents/
│   │   ├── presets.ts            # 8 персонажей с полными биографиями
│   │   ├── personality.ts        # Decay потребностей/эмоций, заражение
│   │   ├── emotionalState.ts     # Настроение, русские лейблы
│   │   ├── planner.ts            # Генерация ежедневных целей (LLM)
│   │   └── attractionMatrix.ts   # Матрица привлекательности
│   │
│   ├── decisions/
│   │   └── decisionEngine.ts     # Выбор действия на каждый тик
│   │
│   ├── conversations/
│   │   └── conversationEngine.ts # Диалоги между агентами
│   │
│   ├── memory/
│   │   ├── memoryStore.ts        # Краткосрочная + долгосрочная память
│   │   ├── importance.ts         # Скоринг важности воспоминаний
│   │   ├── reflectionEngine.ts   # Саморефлексия агентов
│   │   ├── gossipNetwork.ts      # Сплетни с искажением
│   │   └── contextBuilder.ts     # Контекст для LLM-промптов
│   │
│   ├── relationships/
│   │   ├── graph.ts              # Двунаправленный граф отношений
│   │   └── dynamics.ts           # Обновление отношений при взаимодействии
│   │
│   ├── events/
│   │   ├── scheduler.ts          # Расписание событий
│   │   ├── voting.ts             # Механика голосования
│   │   └── tokShow.ts            # Ток-шоу (генерация тем и высказываний)
│   │
│   ├── drama/
│   │   ├── dramaDetector.ts      # Подсчёт уровня драмы
│   │   └── dramaAmplifier.ts     # Усиление при затишье
│   │
│   ├── episodes/
│   │   └── episodeManager.ts     # Эпизоды, фазы, финал
│   │
│   └── llm/
│       ├── provider.ts           # Абстракция LLM (generate/generateJSON)
│       ├── claude.ts             # Anthropic Claude
│       ├── openai.ts             # OpenAI GPT
│       ├── budgetTracker.ts      # Лимиты вызовов и токенов
│       ├── promptBuilder.ts      # Построение системных промптов
│       ├── voiceProfiles.ts      # Голосовые стили персонажей
│       └── errors.ts             # LLMError, LLMBudgetExhausted
│
├── components/
│   ├── canvas/
│   │   ├── HouseScene.tsx        # Canvas 480×360, рендер комнат + агентов
│   │   ├── SpeechBubbles.tsx     # Речевые пузырьки поверх канваса
│   │   ├── drawCharacter.ts      # Отрисовка спрайтов агентов
│   │   ├── drawEnvironment.ts    # Отрисовка комнат и мебели
│   │   ├── spriteConfig.ts       # Цвета и внешность
│   │   └── particleSystem.ts     # Частицы (сердечки, гнев, слёзы)
│   │
│   └── ui/
│       ├── ChatPanel.tsx         # Панель чата
│       ├── AgentBar.tsx          # Панель переключения агентов
│       ├── StatusBar.tsx         # Часы, драма, скорость
│       ├── LocationBar.tsx       # Навигация по комнатам
│       ├── VotingModal.tsx       # Модалка голосования
│       ├── EvictionScreen.tsx    # Экран выселения
│       ├── FinaleScreen.tsx      # Экран финала
│       ├── TokShowOverlay.tsx    # Оверлей ток-шоу
│       ├── ConfessionalView.tsx  # Конфессионная
│       ├── RelationshipMap.tsx   # Карта отношений
│       ├── OnboardingOverlay.tsx # Онбординг
│       ├── CatchUpOverlay.tsx    # Catch-up для новых зрителей
│       └── ...
│
├── store/
│   ├── simulationStore.ts        # Zustand: состояние симуляции
│   ├── viewStore.ts              # Zustand: UI-состояние
│   ├── animationStore.ts         # Zustand: анимации персонажей
│   └── walkingStore.ts           # Zustand: ходьба персонажей
│
├── hooks/
│   ├── useSimulationSSE.ts       # SSE-подключение + mock-режим
│   ├── useAudio.ts               # Управление звуком
│   └── useViewport.ts            # Адаптивная вёрстка
│
└── utils/
    └── screenshotExport.ts       # Экспорт скриншотов
```

## Главный цикл — `Simulation.processTick()`

Каждые 5 секунд (реальных) выполняется один тик:

```
1.  advanceClock()               — +10 игровых минут
2.  calculateEpisode()           — трекинг эпизодов/финала
3.  decayNeeds()                 — потребности убывают
4.  decayEmotions()              — эмоции затухают
5.  applyEmotionalContagion()    — заражение настроением в одной комнате
6.  decayEnergy() / recoverEnergy()
7.  eventScheduler.processTick() — запуск/завершение событий (еда, ток-шоу, голосование, сон)
8.  handleSleeping()             — ночью все в кровати
9.  makeDecision() × N           — каждый свободный агент выбирает действие (LLM или правила)
10. executeDecision() × N        — выполнение: перемещение, разговор, флирт, конфликт...
11. idleWandering()              — свободные агенты бродят (40% шанс)
12. progressConversation() × N   — продолжение активных диалогов (макс 2 за тик)
13. detectDrama() + amplifyDrama()
14. getDramaAlerts()             — дедуплицированные алерты (окно 30 тиков)
15. generateReflection()         — 1-2 агента рефлексируют каждые 30 тиков
16. generateDayPlan()            — цели на день в 08:00
17. emit('state_update')         — стрим дельты клиентам
18. budgetTracker.logStats()     — логирование расходов LLM
19. saveSimulation()             — автосохранение каждые 10 тиков
```

## Модель агента

### Личность (traits)
```
Big Five:    openness, conscientiousness, extraversion, agreeableness, neuroticism (0-100)
Dom2-traits: flirtatiousness, jealousy, loyalty, manipulativeness, dramaTendency,
             humor, stubbornness, sensitivity (0-100)
```

### Потребности (needs) — убывают каждый тик
```
socialNeed      — потребность в общении (↓ быстрее у экстравертов)
validationNeed  — потребность в признании (↓ быстрее у невротиков)
intimacyNeed    — потребность в близости (↓ быстрее у флиртующих)
dominanceNeed   — потребность в доминировании (↓ быстрее у упрямых)
```
Когда потребность < 30 — считается критической и влияет на принятие решений.

### Эмоции (emotions) — затухают с разной скоростью
```
happiness:  медленный decay, тяготение к 50
anger:      быстрый decay (−4/тик)
sadness:    медленный decay (−1)
fear:       средний decay (−1.5)
excitement: средний decay (−2)
jealousy:   очень медленный decay (−0.5)
love:       минимальный decay (−0.2)
```

### Уязвимости (vulnerabilities + vulnerabilityTriggers)
```typescript
vulnerabilityTriggers: [
  {
    keywords: ['слабак', 'тряпка'],
    response: 'агрессия',
    intensity: 0.9,
    behavioralShift: 'Становится враждебным и пытается подавить оппонента'
  }
]
```
Когда в диалоге встречается триггерное слово → активируется `activeVulnerability`, меняющее поведение агента.

## Отношения

Двунаправленный граф с четырьмя осями:

| Ось | Диапазон | Описание |
|-----|---------|----------|
| friendship | −100 ... +100 | Дружба / вражда |
| romance | 0 ... 100 | Романтический интерес |
| trust | −100 ... +100 | Доверие / подозрительность |
| rivalry | 0 ... 100 | Соперничество |

Плюс `alliance: boolean` и `history: RelationshipEvent[]`.

При взаимодействии отношения обновляются через `applyInteraction()`:
- Флирт → +romance, +excitement
- Конфронтация от союзника → ×2 anger, +sadness (предательство)
- Утешение от соперника → ×0.3 happiness, +fear
- Манипуляция при низком trust → цель раскрывает обман

## Память

### Два хранилища
- **Краткосрочная** — 50 записей на агента, FIFO
- **Долгосрочная** — 200 записей, промоция из краткосрочной по importance > 5

### Типы воспоминаний
`observation | conversation | gossip | event | emotion | decision | reflection`

### Важность (importance: 0-10)
Рассчитывается через `calculateImportance(category, context?)`:
- `betrayal` → 8-10
- `argument` → 6-7
- `romantic` → 5-7
- `casual_chat` → 1-2

### Сплетни
Слухи передаются от агента к агенту с искажением:
- Шанс искажения = `(1 - loyalty) × 0.5`
- Драматичные агенты добавляют усилители: «Причём это было при всех!»
- `distortionLevel` растёт с каждой передачей (0→1)

### Рефлексия
Каждые 30 тиков 1-2 агента генерируют рефлексию через LLM — анализ недавних воспоминаний, формирование инсайтов, корректировка стратегии.

## LLM-интеграция

### Провайдеры
```
ClaudeProvider  → claude-3-5-sonnet (strong), claude-3-haiku (cheap)
OpenAIProvider  → gpt-4o-mini (cheap)
```

### Точки вызова LLM
| Что | Модель | Когда |
|-----|--------|-------|
| Решение агента | cheap | Каждый тик для каждого свободного агента |
| Реплика в диалоге | cheap | При прогрессе активной беседы |
| Ток-шоу высказывание | strong | При запуске ток-шоу |
| Рефлексия | cheap | Каждые 30 тиков для 1-2 агентов |
| Дневной план | cheap | Каждое утро (08:00) для всех |
| Ответ ведущему | cheap | При сообщении от ведущего |

### Бюджет
`BudgetTracker` отслеживает:
- Лимит вызовов в час (500) и в день (8000)
- Приоритеты: DECISION < CONVERSATION < MEMORY_REFLECTION
- Подсчёт токенов (in/out)
- Логирование ошибок и retry

### Fallback
Без API-ключа симуляция работает полностью на правилах:
- Решения — по критическим потребностям и случайным весам
- Диалоги — шаблонные фразы по архетипу
- Рефлексии и планирование — отключены

## Событийная модель (SSE)

Клиент подключается к `GET /api/simulation/stream` и получает поток событий:

| Событие | Содержимое | Когда |
|---------|-----------|-------|
| `state_update` | clock, agents[], drama, activeEvents, episode, speed | Каждый тик |
| `conversation` | speakerId, content, emotion, action, location | При реплике |
| `agent_move` | agentId, location, position | При перемещении |
| `drama_alert` | message | При значимом событии |
| `event_start` | eventType, data (topic, statements...) | Начало события |
| `eviction` | agentId, name, day | Выселение |
| `vote_update` | sessionId, totalVotes | Во время голосования |
| `episode_change` | episode | Смена эпизода |
| `finale` | winnerId, winnerName, episode | Финал шоу |
| `catch_up` | clock, evictions, highlights, drama | При подключении |

## Эпизоды и события

### Структура эпизода (7 дней)
```
День 1-2:  Свободное время, знакомство, конфликты
День 3:    Ток-шоу (17:00) — тема + высказывания агентов
День 4:    Свободное время
День 5:    Ток-шоу (17:00)
День 6:    Свободное время, нарастание драмы
День 7:    Голосование (20:00) → выселение
```

### Финал
Срабатывает когда осталось ≤ 3 агентов. Победитель определяется по суммарному friendship-скору.

## Координатные пространства

Два пространства координат:

| Пространство | Размер | Где используется |
|-------------|--------|-----------------|
| Old (server) | ~320×240 | Simulation генерирует позиции |
| New (canvas) | 480×360 | HouseScene рисует |

`remapPosition()` в `coordinates.ts` транслирует old→new с clamping (0.12–0.88).

### Комнаты (LocationId)
```
yard         (0, 0, 480, 130)      — Поляна (верх)
bedroom      (0, 133, 157, 147)    — Спальня (лево-центр)
living_room  (160, 133, 157, 147)  — Гостиная (центр)
kitchen      (320, 133, 160, 147)  — Кухня (право-центр)
bathroom     (0, 283, 157, 77)     — Ванная (лево-низ)
confessional (160, 283, 157, 77)   — Конфессионная (центр-низ)
```

## Персистентность

### Автосохранение
Каждые 10 тиков (~50 сек):
1. `Simulation.saveState()` → сериализует всё состояние
2. Атомарная запись: сначала `.backup.json`, потом `.json`
3. Файл: `data/simulation-save.json`

### Содержимое SaveFile
```typescript
{
  version: 1,
  savedAt: ISO string,
  state: { agents, clock, drama, votingQueue },
  subsystems: {
    relationships,           // граф отношений
    shortTermMemories,       // память (кратко)
    longTermMemories,        // память (долго)
    conversations,           // активные диалоги
    events,                  // запланированные события
    schedulerState,          // lastTokShowDay, lastVotingDay
    votingSessions,          // история голосований
    gossipItems,             // сеть сплетен
  },
  simulationMeta: {
    lastReflectionTick,
    reflectionRotation,
    lastPlanDay,
    recentAlerts,
  }
}
```

### Восстановление
При старте `SimulationManager` проверяет `data/simulation-save.json`:
- Есть → `Simulation.fromSaveFile()`, продолжение с сохранённого тика
- Нет → `new Simulation()`, чистый старт с `createStartingCast()`

## Стейт-менеджмент (клиент)

Четыре Zustand-стора:

| Стор | Назначение |
|------|-----------|
| `simulationStore` | Агенты, часы, драма, чат, алерты, оверлеи, эпизоды |
| `viewStore` | UI-состояние: фокус на комнату, видимость панелей |
| `animationStore` | Состояния анимации агентов (idle, talking, arguing...), facing |
| `walkingStore` | Интерполяция ходьбы, waypoints, скорость |

### Поток данных
```
SSE Event → useSimulationSSE hook → simulationStore.handleSSEEvent()
    ├── state_update → обновить agents, clock, drama
    ├── conversation → добавить chatMessage, обновить animationStore
    ├── agent_move   → запустить walkingStore.startWalk() с pathfinding
    ├── event_start  → показать оверлей (tok_show, confessional)
    ├── eviction     → показать EvictionScreen
    └── finale       → показать FinaleScreen
```

## Canvas-рендер

`HouseScene.tsx` — основной рендер-цикл через `requestAnimationFrame`:

```
1. drawEnvironment()     — комнаты, мебель, стены
2. dimUnfocusedRooms()   — затемнение неактивных комнат
3. buildPositionCache()  — кэш позиций (walkingStore → remapPosition → clampToWalkable)
4. sortByY()             — z-order по Y-позиции
5. drawCharacter() × N   — спрайты с анимацией (idle, talking, sleeping...)
6. emitParticles()       — частицы (сердечки, гнев, слёзы, ZZZ, искры)
7. drawInteractionAuras() — подсветка пар (arguing=красная, flirting=розовая)
8. drawParticles()       — рендер частиц поверх всего
```

## Тестирование

Vitest с тестами для ключевых подсистем:

```
src/engine/clock.test.ts                  — игровое время
src/engine/simulation.test.ts             — основной цикл
src/engine/decisions/decisionEngine.test.ts
src/engine/events/scheduler.test.ts
src/engine/events/voting.test.ts
src/engine/relationships/graph.test.ts
```
