import { supabase } from '../lib/supabaseClient'
import type { WorkerCandidate } from '../types/domain'

function mapCandidate(row: Record<string, unknown>): WorkerCandidate {
  return {
    id: row.id as string,
    name: row.name as string,
    email: row.email as string,
    phone: row.phone as string | undefined,
    skills: row.skills as string[] | undefined,
    verticals: row.verticals as string[] | undefined,
    totalEarned: row.total_earned as number | undefined,
    status: row.status as WorkerCandidate['status'],
    backgroundCheckStatus: row.background_check_status as WorkerCandidate['backgroundCheckStatus'],
    eSignStatus: row.e_sign_status as WorkerCandidate['eSignStatus'],
    verifiedCredentials: row.verified_credentials as string[] | undefined,
    payOption: row.pay_option as WorkerCandidate['payOption'],
    stateCode: row.state_code as string | undefined,
    recruiterName: row.recruiter_name as string | undefined,
    branchName: row.branch_name as string | undefined,
    performanceScore: row.performance_score as number | undefined,
    reliabilityScore: row.reliability_score as number | undefined,
    attendanceRate: row.attendance_rate as number | undefined,
    punctualityRate: row.punctuality_rate as number | undefined,
    completionRate: row.completion_rate as number | undefined,
    clientRatingClass: row.client_rating_class as string | undefined,
    timeToOnboardDays: row.time_to_onboard_days as number | undefined,
    noShowCount: row.no_show_count as number | undefined,
    isRedeployed: row.is_redeployed as boolean | undefined,
    profileUpdated: row.profile_updated as boolean | undefined,
    vendorId: row.vendor_id as string | undefined,
    createdAt: row.created_at as string | undefined,
  }
}

export const candidateService = {
  getAll: async (): Promise<WorkerCandidate[]> => {
    const { data, error } = await supabase.from('candidates').select('*')
    if (error) throw error
    return (data || []).map(mapCandidate)
  },
  getById: async (id: string): Promise<WorkerCandidate | undefined> => {
    const { data, error } = await supabase.from('candidates').select('*').eq('id', id).single()
    if (error) return undefined
    return mapCandidate(data)
  },
}
