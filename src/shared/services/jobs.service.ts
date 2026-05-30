import { supabase } from '../lib/supabaseClient'
import type { Job } from '../types/domain'

function mapJob(row: Record<string, unknown>): Job {
  return {
    id: row.id as string,
    businessName: row.business_name as string,
    vertical: row.vertical as string,
    category: row.category as string,
    blockType: row.block_type as string,
    status: row.status as Job['status'],
    startWindow: row.start_window as string | undefined,
    location: row.location as string | undefined,
    locationName: row.location_name as string | undefined,
    requiredSkills: row.required_skills as string[] | undefined,
    payout: row.payout as number | undefined,
    charge: row.charge as number | undefined,
    billRate: row.bill_rate as number | undefined,
    payRate: row.pay_rate as number | undefined,
    markup: row.markup as number | undefined,
    headcount: row.headcount as number | undefined,
    hoursPerShift: row.hours_per_shift as number | undefined,
    durationShifts: row.duration_shifts as number | undefined,
    shiftStartTime: row.shift_start_time as string | undefined,
    shiftEndTime: row.shift_end_time as string | undefined,
    shiftHours: row.shift_hours as number | undefined,
    overtimeHours: row.overtime_hours as number | undefined,
    stateCode: row.state_code as string | undefined,
    recruiterName: row.recruiter_name as string | undefined,
    branchName: row.branch_name as string | undefined,
    vendorName: row.vendor_name as string | undefined,
    isOutsourced: row.is_outsourced as boolean | undefined,
    swapRequested: row.swap_requested as boolean | undefined,
    dropRequested: row.drop_requested as boolean | undefined,
    incidentsCount: row.incidents_count as number | undefined,
    createdAt: row.created_at as string | undefined,
    branchId: row.branch_id as string | undefined,
    contractorId: row.contractor_id as string | undefined,
    recruiterId: row.recruiter_id as string | undefined,
    vendorId: row.vendor_id as string | undefined,
    invoiceTermDays: row.invoice_term_days as number | undefined,
    invoiceAmountAdjusted: row.invoice_amount_adjusted as number | undefined,
    invoiceAdjustmentNotes: row.invoice_adjustment_notes as string | undefined,
    payrollExpenses: row.payroll_expenses as number | undefined,
    payrollDeductions: row.payroll_deductions as number | undefined,
  }
}

export const jobService = {
  getAll: async (): Promise<Job[]> => {
    const { data, error } = await supabase.from('jobs').select('*')
    if (error) throw error
    return (data || []).map(mapJob)
  },
  getById: async (id: string): Promise<Job | undefined> => {
    const { data, error } = await supabase.from('jobs').select('*').eq('id', id).single()
    if (error) return undefined
    return mapJob(data)
  },
}
