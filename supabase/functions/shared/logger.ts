import { createClient } from 'npm:@supabase/supabase-js@2'

type LogLevel = 'info' | 'success' | 'warning' | 'error'

type IntegrationLogInput = {
  category: 'system' | 'payroll' | 'scheduler' | 'recruiter' | 'worker' | 'sms'
  type: LogLevel
  message: string
  meta?: Record<string, unknown>
}

export async function logEvent(
  supabaseAdmin: ReturnType<typeof createClient>,
  requestId: string,
  input: IntegrationLogInput,
) {
  console.log(JSON.stringify({ requestId, ...input }))

  const { error } = await supabaseAdmin.from('system_logs').insert({
    category: input.category,
    type: input.type,
    message: input.message,
  })

  if (error) {
    console.error(
      JSON.stringify({ requestId, error: 'Failed to write system_log', dbError: error.message }),
    )
  }
}
