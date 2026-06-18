import { createClient } from '@supabase/supabase-js'
import { MOCK_MODE } from './mockData'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

// Fail loud when wired to a real backend without credentials, instead of
// silently constructing a non-functional client against placeholder values.
// In MOCK_MODE no real requests are made, so missing env is fine.
if (!MOCK_MODE && (!supabaseUrl || !supabaseAnonKey)) {
  throw new Error(
    'Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Set them in your .env, or set VITE_MOCK_MODE=true for local UI preview.'
  )
}

export const supabase = createClient(
  // Fallbacks are only ever reached in MOCK_MODE, where the client is never called.
  supabaseUrl || 'http://localhost:54321',
  supabaseAnonKey || 'mock-anon-key',
  {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    realtime: {
      params: {
        eventsPerSecond: 10,
      },
    },
  }
)
