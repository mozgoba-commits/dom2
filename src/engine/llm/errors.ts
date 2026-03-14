// Custom error types for LLM call failures

export class BudgetExceededError extends Error {
  constructor(message = 'LLM call budget exceeded') {
    super(message)
    this.name = 'BudgetExceededError'
  }
}

export class RateLimitError extends Error {
  retryAfterMs: number
  constructor(retryAfterMs = 5000) {
    super(`Rate limited. Retry after ${retryAfterMs}ms`)
    this.name = 'RateLimitError'
    this.retryAfterMs = retryAfterMs
  }
}

export class TimeoutError extends Error {
  constructor(timeoutMs = 10000) {
    super(`LLM call timed out after ${timeoutMs}ms`)
    this.name = 'TimeoutError'
  }
}

export class MalformedResponseError extends Error {
  constructor(message = 'Malformed LLM response') {
    super(message)
    this.name = 'MalformedResponseError'
  }
}
