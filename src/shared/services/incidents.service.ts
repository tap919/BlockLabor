import { supabase } from '../lib/supabaseClient'
import type { IncidentReport } from '../types/domain'

function mapIncident(row: Record<string, unknown>): IncidentReport {
  return {
    id: row.id as string,
    jobId: (row.job_id as string) ?? '',
    businessName: row.business_name as string,
    contractorId: row.contractor_id as string | undefined,
    contractorName: row.contractor_name as string | undefined,
    reportedBy: row.reported_by as IncidentReport['reportedBy'],
    category: row.category as IncidentReport['category'],
    severity: row.severity as IncidentReport['severity'],
    description: (row.description as string) ?? '',
    status: row.status as IncidentReport['status'],
    resolutionNotes: row.resolution_notes as string | undefined,
    timestamp: (row.created_at as string) ?? new Date().toISOString(),
  }
}

export const incidentService = {
  getAll: async (): Promise<IncidentReport[]> => {
    const { data, error } = await supabase.from('incident_reports').select('*')
    if (error) throw error
    return (data || []).map(mapIncident)
  },
  getById: async (id: string): Promise<IncidentReport | undefined> => {
    const { data, error } = await supabase.from('incident_reports').select('*').eq('id', id).single()
    if (error) return undefined
    return mapIncident(data)
  },
}
