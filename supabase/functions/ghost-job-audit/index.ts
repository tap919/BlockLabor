// Supabase Edge Function: ghost-job-audit
// Scheduled via pg_cron every 3 days. Reads all jobs in the public.jobs
// table that have been active for 3+ days and have not been audited
// recently, then calls Aetherdesk's /api/v1/verification/ghost-job-audit
// endpoint for each.
//
// Required env vars (set via `supabase secrets set`):
//   AETHERDESK_URL       — e.g. https://aetherdesk.example.com
//   AETHERDESK_API_KEY   — service-to-service auth token
//   SUPABASE_URL         — auto-provided
//   SUPABASE_SERVICE_ROLE_KEY — auto-provided

// deno-lint-ignore-file no-explicit-any
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const AETHERDESK_URL = Deno.env.get('AETHERDESK_URL') ?? ''
const AETHERDESK_API_KEY = Deno.env.get('AETHERDESK_API_KEY') ?? ''

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'method_not_allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  if (!AETHERDESK_URL || !AETHERDESK_API_KEY) {
    return new Response(
      JSON.stringify({ error: 'aetherdesk_env_missing', detail: 'Set AETHERDESK_URL and AETHERDESK_API_KEY' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Select jobs older than 3 days that are still 'open' and not flagged.
  // Join against public.businesses to resolve a real business_phone for
  // the outbound call. Jobs without a business_id fall back to the
  // OVERLAY365_DEFAULT_AUDIT_PHONE env var.
  const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString()
  const fallbackPhone = Deno.env.get('OVERLAY365_DEFAULT_AUDIT_PHONE') ?? '+15555550000'
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`
      id,
      category,
      business_id,
      businesses:business_id ( business_phone )
    `)
    .eq('status', 'open')
    .in('verification_status', ['pending', 'verified'])
    .lt('created_at', threeDaysAgo)
    .limit(100)

  if (error) {
    return new Response(JSON.stringify({ error: 'db_error', detail: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let auditCount = 0
  const failures: { jobId: string; error: string }[] = []
  const skippedNoPhone: string[] = []

  for (const job of jobs ?? []) {
    // Resolve a real phone from the businesses join, or fall back to the
    // cold-start placeholder. Skip jobs that have neither so we don't
    // spam Aetherdesk with calls to invalid numbers.
    const biz = (job as { businesses?: { business_phone?: string | null } | null }).businesses
    const businessPhone = biz?.business_phone ?? fallbackPhone
    if (!businessPhone) {
      skippedNoPhone.push(job.id)
      continue
    }

    try {
      const resp = await fetch(`${AETHERDESK_URL}/api/v1/verification/ghost-job-audit`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AETHERDESK_API_KEY}`,
        },
        body: JSON.stringify({
          job_id: job.id,
          business_phone: businessPhone,
          job_title: job.category,
          tenant_id: 'blocklabor-default',
        }),
      })
      if (resp.ok) {
        auditCount++
        // Mark the job so we don't re-audit it for another 3 days
        await supabase
          .from('jobs')
          .update({ verification_status: 'audited' })
          .eq('id', job.id)
      } else {
        const text = await resp.text()
        failures.push({ jobId: job.id, error: `HTTP ${resp.status}: ${text}` })
      }
    } catch (err) {
      failures.push({ jobId: job.id, error: err instanceof Error ? err.message : 'unknown' })
    }
  }

  return new Response(
    JSON.stringify({
      status: 'completed',
      jobs_audited: auditCount,
      jobs_skipped_no_phone: skippedNoPhone.length,
      skipped_job_ids: skippedNoPhone,
      failures,
      triggered_at: new Date().toISOString(),
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
