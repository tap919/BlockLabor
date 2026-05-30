import { AppError } from './errors.ts'

export async function withRetry<T>(
  fn: () => Promise<T>,
  attempts = 3,
): Promise<T> {
  let lastError: unknown
  for (let i = 0; i < attempts; i++) {
    try {
      return await fn()
    } catch (err) {
      lastError = err
      if (err instanceof AppError && !err.retryable) {
        throw err
      }
      if (i < attempts - 1) {
        await new Promise((r) => setTimeout(r, 2 ** i * 500 + Math.random() * 300))
      }
    }
  }
  throw lastError
}
