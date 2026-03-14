// LLM call budget tracker — tracks costs, enforces limits, degrades gracefully

export enum LLMCallPriority {
  CONVERSATION = 1,
  DECISION = 2,
  REFLECTION = 3,
  PLANNING = 4,
}

interface CallRecord {
  timestamp: number
  priority: LLMCallPriority
  inputTokens: number
  outputTokens: number
}

interface ErrorRecord {
  timestamp: number
}

interface BudgetConfig {
  maxCallsPerTick: number
  maxCallsPerHour: number
  maxCallsPerDay: number
}

const DEFAULT_CONFIG: BudgetConfig = {
  maxCallsPerTick: 12,
  maxCallsPerHour: 500,
  maxCallsPerDay: 8000,
}

const ERROR_WINDOW_MS = 60_000    // 60 seconds
const ERROR_RATE_THRESHOLD = 0.5   // 50% error rate
const COOLDOWN_MS = 30_000         // 30 seconds cooldown

class BudgetTracker {
  private config: BudgetConfig
  private tickCalls = 0
  private hourCalls: CallRecord[] = []
  private dayCalls: CallRecord[] = []
  private errors: ErrorRecord[] = []
  private cooldownUntil = 0
  private totalCalls = 0
  private totalErrors = 0
  private totalInputTokens = 0
  private totalOutputTokens = 0

  constructor(config: Partial<BudgetConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  startTick() {
    this.tickCalls = 0
  }

  isBudgetAvailable(priority: LLMCallPriority): boolean {
    const now = Date.now()

    // Check cooldown
    if (now < this.cooldownUntil) return false

    // Check tick budget — when partially used, only high-priority calls proceed
    const tickBudgetUsed = this.tickCalls / this.config.maxCallsPerTick
    if (tickBudgetUsed >= 1) return false
    if (tickBudgetUsed >= 0.5 && priority < LLMCallPriority.DECISION) return false
    if (tickBudgetUsed >= 0.75 && priority < LLMCallPriority.REFLECTION) return false

    // Check hourly budget
    this.pruneOldRecords(now)
    if (this.hourCalls.length >= this.config.maxCallsPerHour) return false

    // Check daily budget
    if (this.dayCalls.length >= this.config.maxCallsPerDay) return false

    return true
  }

  recordCall(priority: LLMCallPriority, usage?: { inputTokens: number; outputTokens: number }) {
    const now = Date.now()
    const record: CallRecord = {
      timestamp: now,
      priority,
      inputTokens: usage?.inputTokens ?? 0,
      outputTokens: usage?.outputTokens ?? 0,
    }

    this.tickCalls++
    this.hourCalls.push(record)
    this.dayCalls.push(record)
    this.totalCalls++
    this.totalInputTokens += record.inputTokens
    this.totalOutputTokens += record.outputTokens
  }

  recordError() {
    const now = Date.now()
    this.errors.push({ timestamp: now })
    this.totalErrors++

    // Check error rate in window
    const windowStart = now - ERROR_WINDOW_MS
    const recentErrors = this.errors.filter(e => e.timestamp >= windowStart).length
    const recentCalls = this.hourCalls.filter(c => c.timestamp >= windowStart).length

    if (recentCalls >= 4 && recentErrors / recentCalls >= ERROR_RATE_THRESHOLD) {
      this.cooldownUntil = now + COOLDOWN_MS
      console.warn(`[BudgetTracker] Error rate ${(recentErrors / recentCalls * 100).toFixed(0)}% exceeded threshold. Cooldown for ${COOLDOWN_MS / 1000}s`)
    }
  }

  getStats() {
    const now = Date.now()
    this.pruneOldRecords(now)

    return {
      tickCalls: this.tickCalls,
      hourCalls: this.hourCalls.length,
      dayCalls: this.dayCalls.length,
      totalCalls: this.totalCalls,
      totalErrors: this.totalErrors,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      isInCooldown: now < this.cooldownUntil,
      cooldownRemainingMs: Math.max(0, this.cooldownUntil - now),
      limits: this.config,
    }
  }

  logStats() {
    const stats = this.getStats()
    console.log(
      `[LLM Budget] Tick: ${stats.tickCalls}/${stats.limits.maxCallsPerTick} | ` +
      `Hour: ${stats.hourCalls}/${stats.limits.maxCallsPerHour} | ` +
      `Day: ${stats.dayCalls}/${stats.limits.maxCallsPerDay} | ` +
      `Total: ${stats.totalCalls} calls, ${stats.totalErrors} errors | ` +
      `Tokens: ${stats.totalInputTokens}in/${stats.totalOutputTokens}out` +
      (stats.isInCooldown ? ` | COOLDOWN ${(stats.cooldownRemainingMs / 1000).toFixed(0)}s` : '')
    )
  }

  private pruneOldRecords(now: number) {
    const oneHourAgo = now - 3_600_000
    const oneDayAgo = now - 86_400_000
    const errorWindowStart = now - ERROR_WINDOW_MS

    this.hourCalls = this.hourCalls.filter(c => c.timestamp >= oneHourAgo)
    this.dayCalls = this.dayCalls.filter(c => c.timestamp >= oneDayAgo)
    this.errors = this.errors.filter(e => e.timestamp >= errorWindowStart)
  }

  /** Serialization for persistence */
  toJSON() {
    return {
      totalCalls: this.totalCalls,
      totalErrors: this.totalErrors,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
    }
  }
}

// Singleton
export const budgetTracker = new BudgetTracker()
