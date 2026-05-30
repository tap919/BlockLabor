import { supabase } from '../lib/supabaseClient'
import type { IntegrationSetting } from '../types/domain'

function mapIntegration(row: Record<string, unknown>): IntegrationSetting {
  return {
    id: row.id as string,
    name: row.name as string,
    category: row.category as IntegrationSetting['category'],
    status: row.status as IntegrationSetting['status'],
    apiKey: row.api_key as string | undefined,
    webhookUrl: row.webhook_url as string | undefined,
    lastSync: row.last_sync as string | undefined,
  }
}

export const integrationService = {
  getAll: async (): Promise<IntegrationSetting[]> => {
    const { data, error } = await supabase.from('integrations').select('*')
    if (error) throw error
    return (data || []).map(mapIntegration)
  },
  getById: async (id: string): Promise<IntegrationSetting | undefined> => {
    const { data, error } = await supabase.from('integrations').select('*').eq('id', id).single()
    if (error) return undefined
    return mapIntegration(data)
  },
}
