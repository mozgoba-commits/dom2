# Big Brother AI

**Autonomous reality TV simulation powered by LLMs.**

Eight AI characters live together in a shared house — they build relationships, scheme, argue, fall in love, and vote each other out. All behavior is generated in real-time by neural networks (Claude / OpenAI), producing emergent drama with zero scripting.

Inspired by the Russian reality show "Dom-2".

---

## Quick Start

```bash
# Install dependencies
npm install

# Configure at least one LLM provider
cp .env.example .env.local
# Set ANTHROPIC_API_KEY or OPENAI_API_KEY in .env.local

# Run
npm run dev
```

Open http://localhost:3000 — landing page with the cast. Click **"Watch the Show"** → `/show`.

> Without an API key the simulation runs in fallback mode: template dialogues, rule-based decisions.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Turbopack) |
| UI | React 19, Tailwind CSS 4, Zustand 5 |
| Rendering | Canvas 2D (pixel art, 480 × 360 × 3) |
| LLM | Anthropic Claude 3.5 Sonnet / Haiku, OpenAI GPT-4o-mini |
| Testing | Vitest |
| Language | TypeScript 5 |

---

## The Cast

| # | Name | Archetype | Age | Secret Goal |
|---|------|-----------|-----|-------------|
| 1 | Ruslan Knyazev | Alpha male | 28 | Make Kristina "his" and assert dominance |
| 2 | Timur Sharipov | Quiet strategist | 31 | Control voting from the shadows |
| 3 | Alyona Voronova | Drama queen | 24 | Destroy Kristina as a rival |
| 4 | Kristina Lebedeva | Femme fatale | 26 | Use men to win the show |
| 5 | Marina Sokolova | The moralist | 29 | Prove that honesty wins |
| 6 | Nastya Belova | The naive one | 21 | Find a protector and real love |
| 7 | Dima Kozlov | The rebel | 25 | Expose everyone as fake |
| 8 | Oleg Petrovich | Philosopher-troll | 35 | Collect material for his podcast |

Each character has a detailed biography, Big Five personality traits, Dom2-specific traits (flirtatiousness, jealousy, loyalty, manipulativeness, etc.), vulnerability triggers, behavioral rules (always/never), and a signature catchphrase.

---

## How It Works

### Game Time

| Unit | Real Time | Game Time |
|------|-----------|-----------|
| 1 tick | 5 seconds | 10 minutes |
| 1 hour | 30 seconds | 1 hour |
| 1 day | ~12 minutes | 24 hours |
| 1 episode | ~84 minutes | 7 days |

**Daily schedule:** Wake (08:00) → Breakfast (12:00) → Lunch (13:00) → Talk show (17:00, days 3 & 5) → Dinner (19:00) → Confessional (23:00) → Sleep (00:00–08:00). Voting on day 7.

### Simulation Loop

Every tick (5 real seconds) the server runs the full simulation cycle:

```
 1. Advance clock (+10 game minutes)
 2. Calculate episode phase & finale check
 3. Decay agent needs (social, validation, intimacy, dominance)
 4. Decay emotions (anger fades fast, love barely fades)
 5. Apply emotional contagion (mood spreads between agents in the same room)
 6. Manage energy (drain during day, recover during sleep)
 7. Process scheduled events (meals, talk shows, voting, sleep)
 8. Make decisions — each free agent picks an action (LLM or rule-based)
 9. Execute decisions — move rooms, start conversations, flirt, confront
10. Idle wandering — free agents roam (40% chance)
11. Progress active conversations (max 2 messages per tick)
12. Detect & amplify drama
13. Generate reflections (1-2 agents introspect every 30 ticks)
14. Generate day plans (goals at 08:00 each morning)
15. Stream state to clients via SSE
16. Auto-save (every 10 ticks, ~50 seconds)
```

---

## Core Systems

### Agent Model

**Personality** — 13 traits on a 0–100 scale:
- Big Five: openness, conscientiousness, extraversion, agreeableness, neuroticism
- Show-specific: flirtatiousness, jealousy, loyalty, manipulativeness, drama tendency, humor, stubbornness, sensitivity

**Needs** — decay each tick, drive decision-making when critical (< 30):
- `socialNeed` — decays faster for extraverts
- `validationNeed` — decays faster for neurotics
- `intimacyNeed` — decays faster for flirtatious agents
- `dominanceNeed` — decays faster for stubborn agents

**Emotions** — each with distinct decay rates:
| Emotion | Decay | Notes |
|---------|-------|-------|
| Happiness | −1/tick | Gravitates toward 50 |
| Anger | −4/tick | Fades quickly |
| Sadness | −1/tick | Persistent |
| Fear | −1.5/tick | Moderate |
| Excitement | −2/tick | Medium fade |
| Jealousy | −0.5/tick | Very persistent |
| Love | −0.2/tick | Near-permanent |

**Vulnerability Triggers** — specific keywords in dialogue activate behavioral shifts (e.g., calling the alpha male "weak" triggers aggression; mentioning "home" makes the naive girl cry).

### Relationships

Bidirectional graph with 4 axes per pair:

| Axis | Range | Meaning |
|------|-------|---------|
| friendship | −100 to +100 | Friends ↔ Enemies |
| romance | 0 to 100 | Romantic attraction |
| trust | −100 to +100 | Trust ↔ Suspicion |
| rivalry | 0 to 100 | Competitive tension |

Plus `alliance` (formal pact) and `history` (recent interaction log).

Interactions update relationships dynamically:
- **Flirt** → +romance, +excitement
- **Confrontation from ally** → ×2 anger, +sadness (betrayal)
- **Comfort from rival** → dampened happiness, +fear (suspicion)
- **Manipulation** → detected if target's trust is low enough

### Memory System

**Dual-tier architecture:**
- **Short-term:** 50 memories per agent (FIFO)
- **Long-term:** 200 memories per agent (importance-based pruning)

Memory types: `observation`, `conversation`, `gossip`, `event`, `emotion`, `decision`, `reflection`

**Importance scoring** (0–10): betrayal (8–10) > argument (6–7) > romantic (5–7) > casual chat (1–2). Memories with importance ≥ 5 are promoted to long-term storage.

**Retrieval:** scored by recency (30%), importance (40%), relevance (20%), and gossip bonus (10%).

### Gossip Network

Rumors spread agent-to-agent with distortion:
- Distortion chance = `(1 − loyalty/100) × 0.5`
- Drama-prone agents add intensifiers ("And it happened in front of everyone!")
- `distortionLevel` accumulates 0.2 per dramatic retelling
- Stored as gossip memories with full provenance (origin, spread path)

### Reflections & Planning

Every 30 ticks, 1–2 agents generate introspective reflections via LLM — analyzing recent memories, forming insights, adjusting strategy. These are stored as high-importance memories.

Every morning at 08:00, agents generate a day plan with 3–5 goals (e.g., "Talk to Kristina", "Avoid Ruslan"). Goals influence decision-making when target agents are nearby.

### Decision Engine

Fast-path rules checked in order:
1. Night & not sleeping → go to bed
2. Energy < 15 → rest
3. Critical need (< 30) → pick matching action
4. Planned goals → execute if target nearby
5. High gossip urge → gossip
6. LLM available → ask the model
7. Fallback → random wander

When LLM is available, agents receive their full personality context, recent memories, nearby agents, and relationship scores, then respond with a structured action (talk, flirt, move, confront, etc.).

### Conversation Engine

Conversations are multi-turn dialogues between two agents:
- Max 8 turns (extends to 12 if high tension)
- Min 3 ticks between messages (pacing)
- Max 2 conversation messages per tick (readability)
- Tension (0–10) tracked via conflict keywords and emotional intensity
- Agents can exit explicitly with `[УХОДИТ]` (leaves)

### Drama System

**Detection:** scores drama 0–100 based on:
- High-rivalry relationships (×10)
- Active romances (×8)
- Betrayals / trust collapse (×15)
- Conflict keywords in recent conversations
- Agents with extreme emotions

**Amplification:** if drama < 50 for 30+ ticks, the system intervenes — forces a talk show on a controversial topic, introduces twists, or generates provocative confessional statements.

### Episodes & Voting

**Episode = 7 game days:**
- Days 1–2: Free interaction, establishing dynamics
- Day 3: Talk show (LLM generates dramatic statements on a topic)
- Day 4: Free interaction
- Day 5: Talk show
- Day 6: Tension buildup
- Day 7: Voting → eviction

**Voting mechanics:**
1. Each agent nominates the person they dislike most (lowest `friendship + trust − rivalry`)
2. Top nominees face a vote from all remaining agents
3. Viewer votes weighted 0.5× (capped at agent vote count)
4. Highest votes = evicted

**Finale:** triggers when ≤ 3 agents remain. Winner = highest cumulative friendship score.

**Host twists:** immunity grants, secret reveals, forced returns — sent via API.

---

## LLM Integration

### Providers

| Provider | Cheap Model | Strong Model |
|----------|-------------|-------------|
| Anthropic | claude-3-haiku | claude-3-5-sonnet |
| OpenAI | gpt-4o-mini | gpt-4o-mini |

### Where LLM Is Called

| Purpose | Model | When |
|---------|-------|------|
| Agent decision | cheap | Every tick, per free agent |
| Dialogue reply | cheap | Active conversation progress |
| Talk show statement | strong | Talk show events (days 3, 5) |
| Reflection | cheap | Every 30 ticks, 1–2 agents |
| Day plan | cheap | Every morning (08:00) |
| Host response | cheap | When host sends a message |

### Budget Tracking

- Per-tick limit: 12 calls
- Per-hour limit: 500 calls
- Per-day limit: 8,000 calls
- Graceful degradation: drops low-priority calls first, then conversations, then decisions
- Error rate > 50% in 60s window → 30-second cooldown

### Fallback Mode

Without API keys, everything runs on rules:
- Decisions from critical needs + random weights
- Dialogue from archetype-specific templates
- Reflections and planning disabled
- Gossip still spreads but isn't LLM-generated

---

## Frontend

### Pixel Art Canvas

`HouseScene.tsx` renders at 60 FPS via `requestAnimationFrame`:

```
1. Draw environment — rooms, walls, furniture
2. Dim unfocused rooms (when viewer focuses on one)
3. Position agents — interpolate walks or snap to room positions
4. Sort by Y coordinate (z-order)
5. Draw character sprites — emotion-based palettes, idle/talk/sleep anims
6. Emit particles — hearts, anger clouds, tears, ZZZ, sparkles
7. Draw interaction auras — red (arguing), pink (flirting)
8. Render speech bubbles — text overlay above heads
```

**Rooms:**
```
┌─────────────────────────────────────────────┐
│                   Yard                       │
├──────────────┬──────────────┬───────────────┤
│   Bedroom    │ Living Room  │   Kitchen     │
│              │              │               │
├──────────────┼──────────────┤               │
│  Bathroom    │ Confessional │               │
└──────────────┴──────────────┴───────────────┘
```

### State Management

Four Zustand stores:

| Store | Purpose |
|-------|---------|
| `simulationStore` | Agents, clock, drama, chat, alerts, overlays, episodes |
| `viewStore` | UI state: room focus, panel visibility, mobile detection |
| `animationStore` | Per-agent animation states (idle, talking, arguing, sleeping...) |
| `walkingStore` | Walk interpolation, waypoints, facing direction |

### Data Flow

```
SSE Event → useSimulationSSE hook → simulationStore.handleSSEEvent()
    ├── state_update → update agents, clock, drama
    ├── conversation → add chat message, trigger animation
    ├── agent_move   → start walking interpolation
    ├── event_start  → show overlay (talk show, confessional)
    ├── eviction     → show eviction screen
    └── finale       → show finale screen
```

### UI Components

- **ChatPanel** — scrollable conversation history
- **AgentBar** — character selector with status indicators
- **StatusBar** — game clock, drama meter, speed controls
- **LocationBar** — room navigation / focus
- **VotingModal** — viewer voting interface
- **EvictionScreen** — eviction ceremony animation
- **FinaleScreen** — winner announcement
- **TokShowOverlay** — talk show with agent statements
- **ConfessionalView** — private confessional monologues
- **RelationshipMap** — network graph visualization
- **OnboardingOverlay** — first-time tutorial
- **CatchUpOverlay** — summary for viewers joining mid-show

---

## API

### SSE Stream (primary channel)
```
GET /api/simulation/stream
```
Returns an EventSource stream with events:

| Event | Payload | When |
|-------|---------|------|
| `state_update` | clock, agents[], drama, events, episode, speed | Every tick |
| `conversation` | speakerId, content, emotion, action, location | On dialogue |
| `agent_move` | agentId, location, position | On movement |
| `drama_alert` | message | Major event |
| `event_start` | eventType, data | Activity begins |
| `eviction` | agentId, name, day | Agent eliminated |
| `vote_update` | sessionId, totalVotes | During voting |
| `episode_change` | episode number | New episode |
| `finale` | winnerId, winnerName | Game over |
| `catch_up` | clock, evictions, highlights, drama | On connect |

### Agents
```
GET /api/agents              # All agents with full bios
GET /api/agents/:id          # Single agent details
GET /api/relationships       # Full relationship graph
```

### Controls
```
POST /api/simulation/speed   # { speed: 0|1|2|5 }
POST /api/host/message       # { message, targetAgentId?, type: "message"|"task"|"twist" }
POST /api/vote               # { sessionId, visitorId, nomineeId }
GET  /api/vote               # Current voting session
```

### Host Twists
```json
{ "message": "immunity",       "targetAgentId": "...", "type": "twist" }
{ "message": "secret ...",     "type": "twist" }
{ "message": "bring back all", "type": "twist" }
```

---

## Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                        CLIENT (React)                            │
│                                                                  │
│  Canvas (HouseScene) ◄── Zustand Stores ◄─── SSE Events         │
│  UI Components (Chat, Voting, Overlays, Relationship Map)        │
└──────────────────────────────┬───────────────────────────────────┘
                               │
                   GET /api/simulation/stream
                         (EventSource)
                               │
┌──────────────────────────────┴───────────────────────────────────┐
│                       SERVER (Next.js API Routes)                │
│                                                                  │
│  SimulationManager (singleton, SSE subscriptions)                │
│      │                                                           │
│  Simulation (main loop — processTick)                            │
│      ├── Decision Engine (action selection per agent)             │
│      ├── Conversation Engine (multi-turn dialogues)              │
│      ├── Memory Store (short-term 50 + long-term 200)            │
│      ├── Relationship Graph (4-axis bidirectional)               │
│      ├── Event Scheduler (meals, talk shows, voting, sleep)      │
│      ├── Voting Engine (nominations, tallying, eviction)         │
│      ├── Drama Detector / Amplifier                              │
│      ├── Gossip Network (rumors with distortion)                 │
│      ├── Reflection Engine (periodic introspection)              │
│      ├── Planner (daily goals)                                   │
│      └── LLM Provider (Claude / OpenAI / fallback)               │
│           └── Budget Tracker (per-tick/hour/day limits)           │
│                                                                  │
│  Persistence: data/simulation-save.json (atomic writes)          │
└──────────────────────────────────────────────────────────────────┘
```

### Design Decisions

- **Server-authoritative simulation** — all game state lives on the server; clients are pure renderers. Prevents cheating, ensures consistency across viewers.
- **SSE over WebSockets** — one-way stream is sufficient; simpler to implement and scale. Client actions use REST endpoints.
- **No database** — all state in memory + a single JSON save file. Zero deployment friction, no migrations.
- **Singleton simulation** — one `SimulationManager` instance ensures a single source of truth. Scales comfortably for 8 agents.
- **Hybrid LLM + rules** — fast rule-based path for common decisions, LLM for nuanced choices. Reduces API costs while maintaining emergent behavior.
- **Dual-tier memory** — mirrors human cognition: frequent access to recent events (short-term), important moments preserved long-term.
- **Canvas over DOM** — pixel art aesthetic requires precise control over rendering; Canvas 2D is faster and simpler than managing hundreds of DOM nodes.

---

## Project Structure

```
src/
├── app/                          # Next.js App Router
│   ├── page.tsx                  # Landing page (cast showcase)
│   ├── show/page.tsx             # Main simulation view
│   ├── agents/page.tsx           # Agent catalog
│   └── api/
│       ├── simulation/
│       │   ├── stream/route.ts   # SSE event stream
│       │   └── speed/route.ts    # Playback speed control
│       ├── agents/
│       │   ├── route.ts          # GET all agents
│       │   └── [id]/route.ts     # GET single agent
│       ├── host/message/route.ts # Host messages & twists
│       ├── vote/route.ts         # Voting (GET/POST)
│       └── relationships/route.ts
│
├── engine/                       # Server-side simulation logic
│   ├── simulation.ts             # Main Simulation class & tick loop
│   ├── simulationManager.ts      # Singleton + SSE subscription mgmt
│   ├── types.ts                  # All TypeScript type definitions
│   ├── clock.ts                  # Game time tracking
│   ├── coordinates.ts            # Old↔New layout coordinate remapping
│   ├── collisionMap.ts           # Walkable zones per room
│   ├── pathfinding.ts            # Room-to-room routing
│   ├── persistence.ts            # Save/load with atomic writes
│   │
│   ├── agents/
│   │   ├── presets.ts            # 8 characters with full bios & traits
│   │   ├── personality.ts        # Need/emotion decay, contagion
│   │   ├── emotionalState.ts     # Emotion types & helpers
│   │   ├── planner.ts            # Daily goal generation (LLM)
│   │   └── attractionMatrix.ts   # Interaction target selection
│   │
│   ├── decisions/
│   │   └── decisionEngine.ts     # Per-tick action selection
│   │
│   ├── conversations/
│   │   └── conversationEngine.ts # Multi-turn dialogue management
│   │
│   ├── memory/
│   │   ├── memoryStore.ts        # Dual-tier memory (short + long)
│   │   ├── importance.ts         # Memory importance scoring
│   │   ├── reflectionEngine.ts   # Agent introspection
│   │   ├── gossipNetwork.ts      # Rumor spreading with distortion
│   │   └── contextBuilder.ts     # LLM prompt context assembly
│   │
│   ├── relationships/
│   │   ├── graph.ts              # Bidirectional 4-axis relationship graph
│   │   └── dynamics.ts           # Relationship updates on interaction
│   │
│   ├── events/
│   │   ├── scheduler.ts          # Meals, talk shows, voting, sleep
│   │   ├── voting.ts             # Vote tallying & eviction logic
│   │   └── tokShow.ts            # Talk show topic & statement generation
│   │
│   ├── drama/
│   │   ├── dramaDetector.ts      # Drama score calculation (0-100)
│   │   └── dramaAmplifier.ts     # Auto-boost when drama is stale
│   │
│   ├── episodes/
│   │   └── episodeManager.ts     # 7-day episodes, phases, finale
│   │
│   └── llm/
│       ├── provider.ts           # LLM abstraction (generate/generateJSON)
│       ├── claude.ts             # Anthropic Claude implementation
│       ├── openai.ts             # OpenAI implementation
│       ├── budgetTracker.ts      # Call limits, cooldown, degradation
│       ├── promptBuilder.ts      # System + user prompt construction
│       ├── voiceProfiles.ts      # Character speech styles
│       └── errors.ts             # LLMError, LLMBudgetExhausted
│
├── components/
│   ├── canvas/
│   │   ├── HouseScene.tsx        # Main render loop (rAF, 480×360×3)
│   │   ├── SpeechBubbles.tsx     # Dialogue bubbles above heads
│   │   ├── drawCharacter.ts      # Sprite rendering & animation
│   │   ├── drawEnvironment.ts    # Room & furniture drawing
│   │   ├── spriteConfig.ts       # Character appearance config
│   │   └── particleSystem.ts     # Particles (hearts, anger, tears, ZZZ)
│   │
│   └── ui/                       # React UI components
│       ├── ChatPanel.tsx
│       ├── AgentBar.tsx
│       ├── StatusBar.tsx
│       ├── VotingModal.tsx
│       ├── EvictionScreen.tsx
│       ├── FinaleScreen.tsx
│       ├── TokShowOverlay.tsx
│       ├── ConfessionalView.tsx
│       ├── RelationshipMap.tsx
│       └── ...
│
├── store/                        # Zustand state management
│   ├── simulationStore.ts        # Main game state + SSE handling
│   ├── viewStore.ts              # UI state (modals, focus, panels)
│   ├── animationStore.ts         # Character animation states
│   └── walkingStore.ts           # Walk interpolation & facing
│
├── hooks/
│   ├── useSimulationSSE.ts       # SSE connection + mock fallback
│   ├── useAudio.ts               # Sound management
│   └── useViewport.ts            # Mobile/desktop detection
│
└── utils/
    └── screenshotExport.ts       # Canvas screenshot capture
```

---

## Persistence

The simulation auto-saves to `data/simulation-save.json` every ~50 seconds:
1. `Simulation.saveState()` serializes full state (agents, relationships, memories, conversations, events, gossip, voting sessions, metadata)
2. Atomic write: first to `.backup.json`, then rename to `.json`
3. On server restart, state is restored from save file
4. Delete the save file for a clean start

## Environment Variables

```env
# At least one key required for LLM mode
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
```

## Scripts

```bash
npm run dev       # Dev server (Turbopack)
npm run build     # Production build
npm run start     # Production server
npm run lint      # ESLint
npm test          # Vitest
```

## Testing

```bash
npm test
```

Tests cover core subsystems:
- `simulation.test.ts` — main loop, save/load, catch-up
- `decisionEngine.test.ts` — action selection
- `scheduler.test.ts` — event timing
- `voting.test.ts` — nomination & tallying
- `graph.test.ts` — relationship operations
- `clock.test.ts` — game time math

---

## License

Private project.
