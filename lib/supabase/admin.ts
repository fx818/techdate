import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js'

let _admin: SupabaseClient | null = null

export function createAdminClient(): SupabaseClient {
  if (_admin) return _admin
  _admin = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    }
  )
  return _admin
}
