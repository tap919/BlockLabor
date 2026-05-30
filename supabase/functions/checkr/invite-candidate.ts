import { createClient } from 'npm:@supabase/supabase-js@2'
import { AppError } from '../shared/errors.ts'
import { getRequiredEnv } from '../shared/auth.ts'
import { logEvent } from '../shared/logger.ts'
import { ok, fail } from '../shared/response.ts'
import { withRetry } from '../shared/retry.ts'

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
      message: 'Checkr invite-candidate started',
      meta: { function: 'invite-candidate' },
    })

    if (req.method !== 'POST') {
      throw new AppError('BAD_REQUEST', 'Method not allowed', 400)
    }

    const { candidateId } = await req.json()

    if (!candidateId) {
      throw new AppError('BAD_REQUEST', 'candidateId is required', 400)
    }

    const { data: candidate, error: candidateError } = await supabase
      .from('candidates')
      .select('id, first_name, last_name, email, phone')
      .eq('id', candidateId)
      .single()

    if (candidateError || !candidate) {
      throw new AppError('NOT_FOUND', 'Candidate not found', 404, false, { candidateId })
    }

    const checkrApiKey = getRequiredEnv('CHECKR_API_KEY')

    const checkrCandidate = await withRetry(async () => {
      const res = await fetch('https://api.checkr.com/v1/candidates', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${checkrApiKey}:`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          first_name: candidate.first_name,
          last_name: candidate.last_name,
          email: candidate.email,
          phone: candidate.phone || '',
          work_locations: [],
        }),
      })

      const data = await res.json()

      if (res.status === 401) {
        throw new AppError('INVALID_CREDENTIALS', 'Checkr auth failed', 401, false)
      }
      if (res.status === 429) {
        throw new AppError('RATE_LIMITED', 'Checkr rate limit hit', 503, true)
      }
      if (res.status >= 500) {
        throw new AppError('UPSTREAM_ERROR', 'Checkr server error', 502, true)
      }
      if (!res.ok) {
        throw new AppError('BAD_PROVIDER_RESPONSE', data.error || 'Checkr API error', 502, false)
      }

      return data
    })

    const checkrCandidateId = checkrCandidate.id

    const report = await withRetry(async () => {
      const res = await fetch('https://api.checkr.com/v1/reports', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${btoa(`${checkrApiKey}:`)}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          candidate_id: checkrCandidateId,
          package: 'driver_pro',
        }),
      })

      const data = await res.json()

      if (res.status === 401) {
        throw new AppError('INVALID_CREDENTIALS', 'Checkr auth failed', 401, false)
      }
      if (res.status === 429) {
        throw new AppError('RATE_LIMITED', 'Checkr rate limit hit', 503, true)
      }
      if (res.status >= 500) {
        throw new AppError('UPSTREAM_ERROR', 'Checkr server error', 502, true)
      }
      if (!res.ok) {
        throw new AppError('BAD_PROVIDER_RESPONSE', data.error || 'Failed to create Checkr report', 502, false)
      }

      return data
    })

    await supabase.from('integration_events').insert({
      provider: 'checkr',
      event_type: 'background_check_invited',
      external_id: checkrCandidateId,
      object_type: 'candidate',
      object_id: candidateId,
      status: 'pending',
      payload: { candidate: checkrCandidate, report },
      attempts: 1,
    })

    await supabase
      .from('candidates')
      .update({
        background_check_status: 'pending',
        background_check_id: checkrCandidateId,
      })
      .eq('id', candidateId)

    await logEvent(supabase, requestId, {
      category: 'system',
      type: 'success',
      message: `Checkr invite-candidate completed: ${candidateId}`,
      meta: { function: 'invite-candidate', checkrCandidateId, reportId: report.id },
    })

    return ok({ requestId, checkr_candidate_id: checkrCandidateId, report_id: report.id })
  } catch (error) {
    const err = error instanceof AppError
      ? error
      : new AppError('UNHANDLED_ERROR', error instanceof Error ? error.message : 'Unknown error', 500)

    await logEvent(supabase, requestId, {
      category: 'system',
      type: err.retryable ? 'warning' : 'error',
      message: `${err.code}: ${err.message}`,
      meta: { function: 'invite-candidate', retryable: err.retryable },
    })

    return fail(err, requestId)
  }
})
