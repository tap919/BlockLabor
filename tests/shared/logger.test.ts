import { describe, it, expect } from 'vitest'

describe('shared/logger', () => {
  it('exports logEvent function', async () => {
    const mod = await import('../../supabase/functions/shared/logger.ts')
    expect(typeof mod.logEvent).toBe('function')
  })
})
