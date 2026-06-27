import { createClient } from '@supabase/supabase-js'
import type { Database } from '../types/database'
import { env } from './env'

const supabaseUrl = env.VITE_SUPABASE_URL
const supabaseAnonKey = env.VITE_SUPABASE_ANON_KEY

// The env validation in env.ts should have already thrown an error if these are missing.
// If they are missing here, it indicates a logic error in env validation or import.
if (!supabaseUrl || !supabaseAnonKey) {
  // This error should ideally not be reachable due to env.ts validation.
  throw new Error('Supabase environment variables are critically missing even after validation.');
}

export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)
