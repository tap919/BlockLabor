import { supabase } from '../lib/supabaseClient'
import type { PartnerVendor } from '../types/domain'

function mapVendor(row: Record<string, unknown>): PartnerVendor {
  return {
    id: row.id as string,
    name: row.name as string,
    contactName: row.contact_name as string | undefined,
    email: row.email as string | undefined,
    phone: row.phone as string | undefined,
    verticals: row.verticals as string[] | undefined,
    markupShare: row.markup_share as number | undefined,
    status: row.status as PartnerVendor['status'],
    assignedJobsCount: row.assigned_jobs_count as number | undefined,
    insuranceExpiry: row.insurance_expiry as string | undefined,
    taxId: row.tax_id as string | undefined,
    createdAt: row.created_at as string | undefined,
  }
}

export const vendorService = {
  getAll: async (): Promise<PartnerVendor[]> => {
    const { data, error } = await supabase.from('partner_vendors').select('*')
    if (error) throw error
    return (data || []).map(mapVendor)
  },
  getById: async (id: string): Promise<PartnerVendor | undefined> => {
    const { data, error } = await supabase.from('partner_vendors').select('*').eq('id', id).single()
    if (error) return undefined
    return mapVendor(data)
  },
}
