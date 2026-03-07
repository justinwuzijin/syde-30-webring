import { createClient, SupabaseClient } from '@supabase/supabase-js'

let _client: SupabaseClient | null = null

/**
 * Server-side Supabase client with service role.
 * Use only in API routes — never expose to the client.
 * Lazily initialised so missing env vars don't crash at build time.
 */
export function getSupabaseAdmin(): SupabaseClient {
  if (!_client) {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY
    if (!url || !key) throw new Error('Supabase env vars are not set')
    _client = createClient(url, key)
  }
  return _client
}

/** @deprecated use getSupabaseAdmin() */
export const supabaseAdmin = new Proxy({} as SupabaseClient, {
  get(_t, prop) {
    return (getSupabaseAdmin() as unknown as Record<string | symbol, unknown>)[prop]
  },
})
