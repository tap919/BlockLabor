import { createClient } from 'npm:@supabase/supabase-js@2'
import { AppError } from '../shared/errors.ts'
import { getRequiredEnv } from '../shared/auth.ts'
import { logEvent } from '../shared/logger.ts'
import { ok, fail } from '../shared/response.ts'
import { withRetry } from '../shared/retry.ts'

interface QBEmployee {
  Id?: string
  Employee?: { Id: string }
}

Deno.serve(async (req: Request) => {
  const requestId = crypto.randomUUID()
  const supabase = createClient(
    getRequiredEnv('SUPABASE_URL'),
    getRequiredEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  try {
    await logEvent(supabase, requestId, {
      category: 'system',
      type: 'info',
      message: 'QuickBooks sync started',
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

    const quickbooksAccessToken = getRequiredEnv('QUICKBOOKS_ACCESS_TOKEN')
    const companyId = getRequiredEnv('QUICKBOOKS_COMPANY_ID')

    let qbEmployeeId: string | undefined

    if (action === 'update') {
      const { data: existingEvent } = await supabase
        .from('integration_events')
        .select('external_id')
        .eq('provider', 'quickbooks')
        .eq('object_type', 'candidate')
        .eq('object_id', candidateId)
        .eq('status', 'processed')
        .not('external_id', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      qbEmployeeId = existingEvent?.external_id ?? undefined
    }

    if (action === 'update' && !qbEmployeeId) {
      throw new AppError('NOT_FOUND', 'No QuickBooks employee ID found for this candidate — must create first', 404, false)
    }

    const result = await withRetry(async () => {
      const { endpoint, body, method } = buildRequest(action, candidate, qbEmployeeId)
      const res = await fetch(endpoint, {
        method,
        headers: {
          Authorization: `Bearer ${quickbooksAccessToken}`,
          'Content-Type': 'application/json',
          Accept: 'application/json',
        },
        body: JSON.stringify(body),
      })

      const data: QBEmployee & { Fault?: { Error?: [{ Message?: string }] } } =
        await res.json()

      if (res.status === 401) {
        throw new AppError('INVALID_CREDENTIALS', 'QuickBooks auth failed', 401, false)
      }
      if (res.status === 429) {
        throw new AppError('RATE_LIMITED', 'QuickBooks rate limit hit', 503, true)
      }
      if (res.status >= 500) {
        throw new AppError('UPSTREAM_ERROR', 'QuickBooks server error', 502, true)
      }
      if (!res.ok) {
        const msg = data.Fault?.Error?.[0]?.Message || 'QuickBooks API error'
        throw new AppError('BAD_PROVIDER_RESPONSE', msg, 502, false)
      }

      return data
    })

    const resultingQbId = result.Employee?.Id ?? result.Id

    await supabase.from('integration_events').insert({
      provider: 'quickbooks',
      event_type: `employee_${action}`,
      external_id: resultingQbId,
      object_type: 'candidate',
      object_id: candidateId,
      status: 'processed',
      payload: result,
      attempts: 1,
    })

    await logEvent(supabase, requestId, {
      category: 'system',
      type: 'success',
      message: `QuickBooks employee ${action}d: ${candidateId}`,
      meta: { function: 'sync-employee', qbEmployeeId: resultingQbId },
    })

    return ok({ requestId, quickbooks_employee_id: resultingQbId })
  } catch (error) {
    const err = error instanceof AppError
      ? error
      : new AppError('UNHANDLED_ERROR', error instanceof Error ? error.message : 'Unknown error', 500)

    if (err.code !== 'UNHANDLED_ERROR') {
      await supabase.from('integration_events').insert({
        provider: 'quickbooks',
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
      category: 'system',
      type: err.retryable ? 'warning' : 'error',
      message: `${err.code}: ${err.message}`,
      meta: { function: 'sync-employee', retryable: err.retryable },
    })

    return fail(err, requestId)
  }
})

function buildRequest(
  action: string,
  candidate: { id: string; first_name?: string; last_name?: string; email?: string; phone?: string },
  qbEmployeeId?: string,
): { endpoint: string; method: string; body: Record<string, unknown> } {
  const companyId = getRequiredEnv('QUICKBOOKS_COMPANY_ID')

  if (action === 'create') {
    return {
      endpoint: `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}/employee`,
      method: 'POST',
      body: {
        PrimaryAddr: {},
        PrimaryPhone: { FreeFormNumber: candidate.phone || '' },
        PrintOnCheckName: `${candidate.first_name} ${candidate.last_name}`,
        FamilyName: candidate.last_name,
        GivenName: candidate.first_name,
        BillableTime: false,
      },
    }
  }

  return {
    endpoint: `https://sandbox-quickbooks.api.intuit.com/v3/company/${companyId}/employee`,
    method: 'POST',
    body: {
      Id: qbEmployeeId,
      FamilyName: candidate.last_name,
      GivenName: candidate.first_name,
      PrimaryEmailAddr: { Address: candidate.email },
      sparse: true,
    },
  }
}
