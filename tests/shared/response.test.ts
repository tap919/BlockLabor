import { describe, it, expect } from 'vitest'
import { ok, fail } from '../../supabase/functions/shared/response.ts'
import { AppError } from '../../supabase/functions/shared/errors.ts'

describe('shared/response', () => {
  it('ok returns 200 with data', () => {
    const res = ok({ test: true })
    expect(res.status).toBe(200)
  })

  it('fail returns error status with error body', () => {
    const err = new AppError('TEST', 'fail', 400, false)
    const res = fail(err, 'req-123')
    expect(res.status).toBe(400)
  })
})
