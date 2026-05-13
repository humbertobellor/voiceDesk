// src/app/actions/onboarding.ts
// Server actions for onboarding flow
'use server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'

type ActionResult = { ok: true } | { ok: false; error: string }

/**
 * Mark contractor as live after test call verification.
 * Called by OnboardingWizard when test call is detected.
 */
export async function markContractorLive(contractorId: string): Promise<ActionResult> {
  // 1. Authorization: validate user is signed in
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { ok: false, error: 'Not signed in.' }

  // 2. Validate the contractor belongs to this user
  const serviceClient = createServiceRoleClient()
  const { data: contractor, error: cErr } = await serviceClient
    .from('contractors')
    .select('id')
    .eq('id', contractorId)
    .eq('user_id', user.id)
    .maybeSingle()

  if (cErr || !contractor) {
    console.error('[markContractorLive] contractor not found or not owned by user:', contractorId)
    return { ok: false, error: 'Contractor not found or access denied.' }
  }

  // 3. Update is_live status to true
  const { error: uErr } = await serviceClient
    .from('contractors')
    .update({ is_live: true })
    .eq('id', contractorId)

  if (uErr) {
    console.error('[markContractorLive] update failed:', uErr.message)
    return { ok: false, error: 'Failed to mark contractor as live.' }
  }

  console.log('[markContractorLive] contractor marked as live:', contractorId)
  return { ok: true }
}