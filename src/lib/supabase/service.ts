// src/lib/supabase/service.ts
// Source: RESEARCH.md Code Examples — Account Creation route.
// CRITICAL: This file is server-only. SUPABASE_SERVICE_ROLE_KEY must NEVER have NEXT_PUBLIC_ prefix.
// Service role bypasses RLS — use only in API routes for operations the user's anon client cannot perform.
import { createClient } from '@supabase/supabase-js'

export function createServiceRoleClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !serviceRoleKey) {
    throw new Error(
      'createServiceRoleClient requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY. ' +
      'The service role key MUST NOT be prefixed with NEXT_PUBLIC_ (would expose to browser).'
    )
  }
  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
