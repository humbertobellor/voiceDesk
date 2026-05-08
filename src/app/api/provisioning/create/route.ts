// src/app/api/provisioning/create/route.ts
// POST — provisions a Twilio phone number and Retell AI agent for a contractor.
// D-09: triggered by Phase 7 onboarding wizard (not by UI in Phase 2).
// D-10: no auto-fallback on area code; returns 422 with [786, 954, 561] suggestions.
// D-11: Supabase write is LAST after all Retell calls succeed (exception to DB-first rule —
//       if Retell calls fail, no orphaned DB state because we haven't written yet).
// twilio_number_sid: stores E.164 phone_number from Retell as the internal number reference.
//   This is NOT a true Twilio SID (PN... format) — it is Retell's phone number identifier.
//   (RESOLVED: RESEARCH.md Open Question 2)
// Source: RESEARCH.md Pattern 5; analog: src/app/api/onboarding/create-account/route.ts
import { NextResponse } from 'next/server'
import { createSupabaseServer } from '@/lib/supabase/server'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getRetellClient, toRetellLanguage } from '@/lib/retell/client'
import { buildSystemPrompt, buildBeginMessage } from '@/lib/retell/system-prompt'
import { z } from 'zod'

const provisionSchema = z.object({
  area_code: z.string().regex(/^\d{3}$/, 'Area code must be exactly 3 digits.'),
})

export async function POST(req: Request) {
  // 1. Auth — getUser() validates JWT; never use getSession() (RESEARCH.md Security Domain ASVS V2)
  const supabase = await createSupabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. Validate request body — area_code from body (D-08); never trust client contractor_id
  const body = provisionSchema.safeParse(await req.json())
  if (!body.success) {
    return NextResponse.json({ error: body.error.issues[0]?.message ?? 'Invalid input' }, { status: 400 })
  }

  const serviceClient = createServiceRoleClient()

  // 3. Load contractor by user_id from JWT (STRIDE: Elevation of Privilege — never accept contractor_id from body)
  const { data: contractor, error: loadErr } = await serviceClient
    .from('contractors')
    .select('id, retell_agent_id, retell_llm_id, contractor_settings(*)')
    .eq('user_id', user.id)
    .maybeSingle()

  if (loadErr || !contractor) {
    console.error('[provisioning/create] contractor load failed:', loadErr?.message)
    return NextResponse.json({ error: 'Contractor not found.' }, { status: 404 })
  }

  // 4. Idempotency check — already provisioned (STRIDE: Tampering — duplicate provisioning)
  if (contractor.retell_agent_id) {
    return NextResponse.json({ error: 'Already provisioned.' }, { status: 409 })
  }

  // Supabase infers contractor_settings as any[] due to the generic join type; cast via unknown.
  const settings = contractor.contractor_settings as unknown as {
    business_name: string
    trade_type: string
    service_area: string
    supported_languages: string[]
    emergency_keywords: { en: string[]; es: string[] }
    after_hours_message: string
    agent_voice: string
  } | null
  if (!settings) {
    console.error('[provisioning/create] contractor_settings missing for contractor:', contractor.id)
    return NextResponse.json({ error: 'Contractor settings not configured. Please complete onboarding.' }, { status: 422 })
  }

  const retell = getRetellClient()

  // 5. Create Retell LLM (system prompt lives here, not on the agent)
  let llm: { llm_id: string }
  try {
    llm = await retell.llm.create({
      model: 'gpt-4.1',
      general_prompt: buildSystemPrompt(settings as Parameters<typeof buildSystemPrompt>[0]),
      begin_message: buildBeginMessage(settings as Parameters<typeof buildBeginMessage>[0]),
    }) as { llm_id: string }
  } catch (err) {
    console.error('[provisioning/create] llm.create failed:', err instanceof Error ? err.message : err)
    return NextResponse.json({ error: 'Failed to initialize AI agent. Please try again.' }, { status: 500 })
  }

  // 6. Create Retell Agent (references the LLM)
  let agent: { agent_id: string }
  try {
    agent = await retell.agent.create({
      response_engine: { type: 'retell-llm', llm_id: llm.llm_id },
      voice_id: settings.agent_voice,
      agent_name: `${settings.business_name} Receptionist`,
      // toRetellLanguage returns a locale code (e.g., 'en-US') matching Retell's union type.
      // Cast via unknown to bridge our string return type to Retell's strict locale union.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      language: toRetellLanguage(settings.supported_languages) as any,
    }) as { agent_id: string }
  } catch (err) {
    console.error('[provisioning/create] agent.create failed:', err instanceof Error ? err.message : err)
    try { await retell.llm.delete(llm.llm_id) } catch (cleanupErr) {
      console.error('[provisioning/create] ORPHANED LLM — llm_id:', llm.llm_id, '— manual cleanup required')
    }
    return NextResponse.json({ error: 'Failed to create AI agent. Please try again.' }, { status: 500 })
  }

  // 7. Buy phone number and bind agent — D-10: 422 with suggestions if no numbers available
  let phone: { phone_number: string }
  try {
    phone = await retell.phoneNumber.create({
      area_code: parseInt(body.data.area_code, 10),
      inbound_agents: [{ agent_id: agent.agent_id, weight: 1.0 }],
      nickname: settings.business_name,
    }) as { phone_number: string }
  } catch (err) {
    const retellMsg = (err as { error?: { message?: string } }).error?.message ?? ''
    console.error('[provisioning/create] phoneNumber.create failed:', retellMsg || (err instanceof Error ? err.message : err))
    // Best-effort cleanup of already-created Retell resources
    try {
      await retell.agent.delete(agent.agent_id)
      await retell.llm.delete(llm.llm_id)
    } catch (cleanupErr) {
      console.error('[provisioning/create] ORPHANED Retell resources — agent_id:', agent.agent_id, 'llm_id:', llm.llm_id, '— manual cleanup required')
    }
    if (retellMsg.toLowerCase().includes('card') || retellMsg.toLowerCase().includes('payment')) {
      return NextResponse.json({ error: 'Retell account requires a payment method. Add a card at retell.ai/dashboard/billing.' }, { status: 402 })
    }
    if (retellMsg.toLowerCase().includes('kyc')) {
      return NextResponse.json({ error: 'Retell account requires identity verification (KYC). Purchase a number manually in the Retell dashboard first.' }, { status: 402 })
    }
    return NextResponse.json(
      { error: `No numbers available in area code ${body.data.area_code}. Try: 786, 954, or 561.` },
      { status: 422 }
    )
  }

  // 8. Persist all IDs to Supabase (DB write is LAST — all Retell calls must succeed first)
  // twilio_number_sid stores the E.164 phone_number as Retell's internal number reference.
  // This is NOT a Twilio SID format (PN...) — it is the correct identifier for Retell number management.
  // (RESOLVED: RESEARCH.md Open Question 2 — store E.164 phone_number in twilio_number_sid)
  const { error: updateErr } = await serviceClient
    .from('contractors')
    .update({
      retell_agent_id: agent.agent_id,
      retell_llm_id: llm.llm_id,
      twilio_number: phone.phone_number,
      twilio_number_sid: phone.phone_number,  // E.164 — Retell number reference (not a Twilio SID)
      agent_sync_status: 'synced',
      area_code: body.data.area_code,
      updated_at: new Date().toISOString(),
    })
    .eq('id', contractor.id)

  if (updateErr) {
    console.error('[provisioning/create] contractors update failed:', updateErr.message)
    // Retell resources are orphaned — log for manual cleanup
    console.error('[provisioning/create] ORPHANED Retell resources — agent_id:', agent.agent_id, 'llm_id:', llm.llm_id, 'phone:', phone.phone_number)
    return NextResponse.json({ error: 'Failed to save provisioning data. Contact support.' }, { status: 500 })
  }

  return NextResponse.json({
    twilio_number: phone.phone_number,
    retell_agent_id: agent.agent_id,
  })
}
