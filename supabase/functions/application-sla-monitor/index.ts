// Supabase Edge Function: application-sla-monitor
// Scheduled via pg_cron every 6 hours. Reads all jobs whose
// application_response_sla has passed and triggers Aetherdesk SLA
// breach calls to the business.

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
      JSON.stringify({ error: 'aetherdesk_env_missing' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } },
    )
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
  )

  // Select jobs whose SLA has passed and that are still open
  const now = new Date().toISOString()
  const { data: jobs, error } = await supabase
    .from('jobs')
    .select(`
      id,
      business_id,
      businesses:business_id ( business_phone )
    `)
    .eq('status', 'open')
    .lt('application_response_sla', now)
    .neq('verification_status', 'flagged')
    .limit(100)

  if (error) {
    return new Response(JSON.stringify({ error: 'db_error', detail: error.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  let alertCount = 0
  const skippedNoPhone: string[] = []
  const fallbackPhone = Deno.env.get('OVERLAY365_DEFAULT_AUDIT_PHONE') ?? '+15555550000'

  for (const job of jobs ?? []) {
    const biz = (job as { businesses?: { business_phone?: string | null } | null }).businesses
    const businessPhone = biz?.business_phone ?? fallbackPhone
    if (!businessPhone) {
      skippedNoPhone.push(job.id)
      continue
    }
    const slaHoursBreached = 24

    try {
      const resp = await fetch(`${AETHERDESK_URL}/api/v1/verification/application-sla-breach`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${AETHERDESK_API_KEY}`,
        },
        body: JSON.stringify({
          job_id: job.id,
          business_phone: businessPhone,
          applicant_name: 'Top applicant',
          sla_hours_breached: slaHoursBreached,
          tenant_id: 'blocklabor-default',
        }),
      })
      if (resp.ok) {
        alertCount++
        // Mark as flagged so we don't re-alert for the same breach
        await supabase
          .from('jobs')
          .update({ verification_status: 'flagged' })
          .eq('id', job.id)
      }
    } catch {
      // Best-effort; next cron tick will retry.
    }
  }

  return new Response(
    JSON.stringify({
      status: 'completed',
      sla_alerts_sent: alertCount,
      jobs_skipped_no_phone: skippedNoPhone.length,
      skipped_job_ids: skippedNoPhone,
      triggered_at: now,
    }),
    { status: 200, headers: { 'Content-Type': 'application/json' } },
  )
})
