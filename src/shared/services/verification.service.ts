/**
 * Verification Service — Overlay365 Truth-Verified Labor Exchange
 *
 * Single client-side integration point for all calls from BlockLabor
 * into Aetherdesk's outbound verification system.
 *
 * - Triggers business identity verification on business signup
 * - Triggers ghost-job audits on TTL pings
 * - Triggers SLA breach alerts on employer response delay
 */

const AETHERDESK_BASE_URL = (typeof window !== 'undefined' && (window as { __AETHERDESK_URL__?: string }).__AETHERDESK_URL__) || '/api/v1'

async function postVerification(path: string, body: Record<string, unknown>) {
  const response = await fetch(`${AETHERDESK_BASE_URL}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${localStorage.getItem('sb-access-token') ?? ''}`,
    },
    body: JSON.stringify(body),
  })
  if (!response.ok) {
    const text = await response.text().catch(() => 'unknown error')
    throw new Error(`Aetherdesk ${path} failed: ${response.status} ${text}`)
  }
  return response.json()
}

export interface BusinessIdentityVerificationParams {
  businessName: string
  businessPhone: string
  businessEin: string
  businessState: string
  tenantId: string
}

export interface GhostJobAuditParams {
  jobId: string
  businessPhone: string
  jobTitle: string
  tenantId: string
}

export interface ApplicationSLABreachParams {
  jobId: string
  businessPhone: string
  applicantName: string
  slaHoursBreached: number
  tenantId: string
}

export const verificationService = {
  /**
   * Call when a new business is created in BlockLabor.
   * Triggers an outbound call to verify EIN and state registration.
   */
  async verifyBusinessIdentity(params: BusinessIdentityVerificationParams) {
    return postVerification('/verification/business-identity', {
      business_name: params.businessName,
      business_phone: params.businessPhone,
      business_ein: params.businessEin,
      business_state: params.businessState,
      tenant_id: params.tenantId,
    })
  },

  /**
   * Call when a job has been active for 3 days without resolution
   * to confirm the posting is still live.
   */
  async auditGhostJob(params: GhostJobAuditParams) {
    return postVerification('/verification/ghost-job-audit', {
      job_id: params.jobId,
      business_phone: params.businessPhone,
      job_title: params.jobTitle,
      tenant_id: params.tenantId,
    })
  },

  /**
   * Call when an employer has not responded to a candidate
   * within the application_response_sla window.
   */
  async alertSLABreach(params: ApplicationSLABreachParams) {
    return postVerification('/verification/application-sla-breach', {
      job_id: params.jobId,
      business_phone: params.businessPhone,
      applicant_name: params.applicantName,
      sla_hours_breached: params.slaHoursBreached,
      tenant_id: params.tenantId,
    })
  },
}
