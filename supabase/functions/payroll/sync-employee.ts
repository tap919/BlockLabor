import { createClient } from 'npm:@supabase/supabase-js@2'
import { AppError } from '../shared/errors.ts'
import { getRequiredEnv } from '../shared/auth.ts'
import { logEvent } from '../shared/logger.ts'
import { ok, fail } from '../shared/response.ts'
import { withRetry } from '../shared/retry.ts'

interface GustoEmployee {
  id?: string
  errors?: [{ message?: string }]
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID()
  const supabase = createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  try {
    await logEvent(supabase, requestId, {
      category: 'payroll',
      type: 'info',
      message: 'Gusto sync started',
      meta: { function: 'sync-employee' },
    })

    if (req.method !== 'POST') {
      throw new AppError('BAD_REQUEST', 'Method not allowed', 400)
    }

    const { candidateId, action }: { candidateId?: string; action?: string } =
      await req.json()

    if (!candidateId || !action) {
      throw new AppError('BAD_REQUEST', 'candidateId and action are required', 400)
    }

    const { data: candidate } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, email, phone')
      .eq('id', candidateId)
      .single()

    if (!candidate) {
      throw new AppError('NOT_FOUND', 'Candidate not found', 404, false, { candidateId })
    }

    const gustoApiKey = getRequiredEnv('GUSTO_API_KEY')

    const result = await withRetry(async () => {
      const res = await fetch('https://api.gusto.com/v1/employees', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${gustoApiKey}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify({
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          email: candidate.email,
          phone: candidate.phone || '',
          start_date: new Date().toISOString().split('T')[0],
        }),
      })

      const data: GustoEmployee = await res.json()

      if (res.status === 401) {
        throw new AppError('INVALID_CREDENTIALS', 'Gusto auth failed', 401, false)
      }
      if (res.status === 429) {
        throw new AppError('RATE_LIMITED', 'Gusto rate limit hit', 503, true)
      }
      if (res.status >= 500) {
        throw new AppError('UPSTREAM_ERROR', 'Gusto server error', 502, true)
      }
      if (!res.ok) {
        const msg = data.errors?.[0]?.message || 'Gusto API error'
        throw new AppError('BAD_PROVIDER_RESPONSE', msg, 502, false)
      }

      return data
    })

    const gustoEmployeeId = result.id

    await supabase.from('integration_events').insert({
      provider: 'gusto',
      event_type: `employee_${action}`,
      external_id: gustoEmployeeId,
      object_type: 'candidate',
      object_id: candidateId,
      status: 'processed',
      payload: result,
      attempts: 1,
    })

    await logEvent(supabase, requestId, {
      category: 'payroll',
      type: 'success',
      message: `Gusto employee ${action}d: ${candidateId}`,
      meta: { function: 'sync-employee', gustoEmployeeId },
    })

    return ok({ requestId, gusto_employee_id: gustoEmployeeId })
  } catch (error) {
    const err = error instanceof AppError
      ? error
      : new AppError('UNHANDLED_ERROR', error instanceof Error ? error.message : 'Unknown error', 500)

    if (err.code !== 'UNHANDLED_ERROR') {
      await supabase.from('integration_events').insert({
        provider: 'gusto',
        event_type: 'api_call_failed',
        external_id: null,
        object_type: 'candidate',
        object_id: err.details?.candidateId as string | undefined || null,
        status: 'failed',
        payload: { error: err.message },
        attempts: 1,
        last_error: err.message,
      })
    }

    await logEvent(supabase, requestId, {
      category: 'payroll',
      type: err.retryable ? 'warning' : 'error',
      message: `${err.code}: ${err.message}`,
      meta: { function: 'sync-employee', retryable: err.retryable },
    })

    return fail(err, requestId)
  }
})
