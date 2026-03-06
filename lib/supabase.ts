import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

/**
 * Server-side Supabase client with service role.
 * Use only in API routes — never expose to the client.
 */
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceRoleKey)
