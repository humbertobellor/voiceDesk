// src/app/api/provisioning/update-agent/route.ts
// PATCH — re-syncs the Retell AI agent when contractor settings change.
//
// DESIGN: This route is INTENTIONALLY re-sync-only.
// D-11 ("always persist to Supabase first") is satisfied at the PHASE 6 level:
//   Phase 6 settings save action → writes new settings to contractor_settings FIRST
//                                → then calls PATCH /api/provisioning/update-agent
// This route reads the already-updated settings from DB and syncs to Retell.
// DO NOT add a contractor_settings write step here — that would violate the separation
// of concerns. The caller (Phase 6) is responsible for the DB write before calling this route.
//
// D-12: Retell failure → queue Inngest retry; never surface Retell errors to caller.
// Source: RESEARCH.md Agent Re-sync Call Sequence; PATTERNS.md update-agent section.
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getRetellClient } from '@/lib/retell/client'
import { buildSystemPrompt, buildBeginMessage } from '@/lib/retell/system-prompt'
import { inngest } from '@/inngest/client'

export async function PATCH(_req: Request) {
  // 1. Auth — getUser() validates JWT; never use getSession()
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceClient = createServiceRoleClient()

  // 2. Load contractor + settings by user_id from JWT (never accept contractor_id from body)
  // Settings are already updated in Supabase by the Phase 6 caller (D-11 satisfied upstream).
  const { data: contractor, error: loadErr } = await serviceClient
    .from('contractors')
    .select('id, retell_llm_id, agent_sync_status, contractor_settings(*)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadErr || !contractor || !contractor.retell_llm_id) {
    if (loadErr) console.error('[provisioning/update-agent] contractor load failed:', loadErr.message)
    return NextResponse.json({ error: 'Contractor not provisioned.' }, { status: 404 })
  }

  // Supabase returns one-to-one FK joins as a single object (not an array).
  const settings = contractor.contractor_settings as unknown as Parameters<typeof buildSystemPrompt>[0] | null
  if (!settings) {
    console.error('[provisioning/update-agent] contractor_settings missing for contractor:', contractor.id)
    return NextResponse.json({ error: 'Contractor settings not configured.' }, { status: 422 })
  }

  // 3. Set agent_sync_status to 'pending' BEFORE Retell call (D-12 key link: pending must precede Retell)
  await serviceClient
    .from('contractors')
    .update({ agent_sync_status: 'pending' })
    .eq('id', contractor.id)

  const compiledPrompt = buildSystemPrompt(settings)
  const beginMessage = buildBeginMessage(settings)

  // 4. Attempt Retell sync; queue Inngest retry on failure (D-12)
  try {
    const retell = getRetellClient()
    await retell.llm.update(contractor.retell_llm_id, {
      general_prompt: compiledPrompt,
      begin_message: beginMessage,
    })
    // Success: mark synced
    await serviceClient
      .from('contractors')
      .update({ agent_sync_status: 'synced' })
      .eq('id', contractor.id)
  } catch (err) {
    console.error('[provisioning/update-agent] Retell sync failed, queuing Inngest retry:', err instanceof Error ? err.message : err)
    await inngest.send({
      name: 'retell/agent.sync',
      data: {
        contractorId: contractor.id,
        llmId: contractor.retell_llm_id,
        compiledPrompt,
        beginMessage,
      },
    })
  }

  // 5. Always return 200 — never surface Retell errors to the caller (D-12)
  return NextResponse.json({ ok: true })
}
