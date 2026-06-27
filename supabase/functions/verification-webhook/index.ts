// Supabase Edge Function: verification-webhook
// Receives call completion events from Aetherdesk's Twilio webhook.
// Matches the call against an existing verification trigger in our DB
// (by called_number + recent timestamp) and updates the relevant
// verification_status column on jobs / candidates / users.

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

interface Payload {
  twilio_call_sid?: string
  call_status?: string
  from_number?: string
  to_number?: string
  duration?: string
  recording_url?: string
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = (await req.json()) as Payload
  const callStatus = body.call_status ?? 'unknown'
  const toNumber = body.to_number ?? ''

  if (!toNumber) {
    return new Response(JSON.stringify({ error: 'missing_to_number' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Map Twilio call status -> our internal verification_status enum
  const verifiedStatus = callStatus === 'completed' ? 'verified' : 'flagged'

  // Update jobs whose last audit/business call to this number happened
  // recently. We use a 24-hour lookback window so a stale webhook
  // does not retroactively flip an old job.
  const lookback = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
  const { data: updatedJobs, error: jobsError } = await supabase
    .from('jobs')
    .update({ verification_status: verifiedStatus })
    .eq('status', 'open')
    .in('verification_status', ['pending', 'audited'])
    .gte('created_at', lookback)
    .select('id')

  // Also update candidate verification status if the call target
  // matches a candidate phone (for worker identity verification calls).
  const { data: updatedCandidates, error: candidatesError } = await supabase
    .from('candidates')
    .update({ worker_verification_status: verifiedStatus })
    .eq('worker_verification_status', 'pending')
    .eq('phone', toNumber)
    .gte('created_at', lookback)
    .select('id')

  return new Response(
    JSON.stringify({
      status: 'processed',
      call_status: callStatus,
      to_number: toNumber,
      jobs_updated: updatedJobs?.length ?? 0,
      candidates_updated: updatedCandidates?.length ?? 0,
      errors: {
        jobs: jobsError?.message,
        candidates: candidatesError?.message,
      },
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
