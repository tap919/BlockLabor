import { describe, it, expect } from 'vitest'
import { AppError } from '../../supabase/functions/shared/errors.ts'

describe('shared/errors', () => {
  it('creates AppError with correct properties', () => {
    const err = new AppError('TEST_CODE', 'test message', 400, true)
    expect(err.code).toBe('TEST_CODE')
    expect(err.message).toBe('test message')
    expect(err.status).toBe(400)
    expect(err.retryable).toBe(true)
    expect(err.name).toBe('AppError')
  })
})
