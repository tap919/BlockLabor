import { supabase } from '../lib/supabaseClient'
import type { PartnerVendor, VerticalType } from '../types/domain'

function mapVendor(row: Record<string, unknown>): PartnerVendor {
  return {
    id: row.id as string,
    name: row.name as string,
    contactName: (row.contact_name as string) ?? '',
    email: (row.email as string) ?? '',
    phone: (row.phone as string) ?? '',
    verticals: (row.verticals as VerticalType[]) ?? [],
    markupShare: (row.markup_share as number) ?? 0,
    status: row.status as PartnerVendor['status'],
    assignedJobsCount: (row.assigned_jobs_count as number) ?? 0,
    insuranceExpiry: (row.insurance_expiry as string) ?? '',
    taxId: (row.tax_id as string) ?? '',
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
