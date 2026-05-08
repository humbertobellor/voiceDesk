// src/app/api/webhooks/retell/handlers.ts
// call_ended: creates skeleton calls row (analysis_status='analyzing')
// call_analyzed: enriches row with transcript + summary, fires Inngest classification job
// T-03-02: contractor_id is NEVER taken from the webhook payload — always looked up by agent_id server-side.
// D-05: Both handlers use UPSERT on retell_call_id — idempotent on duplicate webhook delivery.
import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { inngest } from '@/inngest/client'
import { detectAfterHours } from '@/lib/after-hours/detect'
import type { RetellCallPayload } from '@/lib/retell/webhook-types'
import type { BusinessHours } from '@/lib/after-hours/detect'

/**
 * call_ended: creates skeleton calls row.
 * Sets status='completed', analysis_status='analyzing', is_after_hours.
 * contractor_id is resolved server-side from call.agent_id (T-03-02 — never from payload).
 * D-05: UPSERT on retell_call_id handles duplicate webhook deliveries idempotently.
 */
export async function processCallEnded(call: RetellCallPayload): Promise<void> {
  const db = createServiceRoleClient()

  // T-03-02: Look up contractor by retell_agent_id from webhook payload
  // NEVER accept contractor_id directly from the payload — attacker could supply wrong ID
  const { data: contractor, error: lookupError } = await db
    .from('contractors')
    .select('id, timezone, contractor_settings(business_hours)')
    .eq('retell_agent_id', call.agent_id)
    .maybeSingle()

  if (lookupError) {
    console.error('[webhook/call_ended] contractor lookup error:', lookupError.message)
    return
  }
  if (!contractor) {
    console.error('[webhook/call_ended] no contractor found for agent_id:', call.agent_id)
    return // Unknown agent — not our event; return silently
  }

  // D-11: After-hours detection — pure timestamp comparison, no LLM
  // Supabase returns one-to-one FK joins as a single object; cast via unknown for type safety
  const settings = contractor.contractor_settings as unknown as { business_hours: BusinessHours } | null
  const isAfterHours = settings?.business_hours && call.start_timestamp
    ? detectAfterHours(
        new Date(call.start_timestamp),
        settings.business_hours,
        contractor.timezone ?? 'America/New_York'
      )
    : false

  // D-05: UPSERT on retell_call_id — idempotent; duplicate call_ended → same row updated
  const { error: upsertError } = await db.from('calls').upsert(
    {
      contractor_id: contractor.id,
      retell_call_id: call.call_id,
      caller_phone: call.from_number ?? null,
      twilio_number: call.to_number ?? null,
      status: 'completed',
      analysis_status: 'analyzing',  // D-02/D-03: skeleton row state
      started_at: call.start_timestamp ? new Date(call.start_timestamp).toISOString() : null,
      ended_at: call.end_timestamp ? new Date(call.end_timestamp).toISOString() : null,
      duration_seconds: call.duration_ms ? Math.round(call.duration_ms / 1000) : null,  // duration_ms NOT duration_seconds
      recording_url: call.recording_url ?? null,  // D-16: store as-is
      is_after_hours: isAfterHours,
    },
    { onConflict: 'retell_call_id' }  // D-05: idempotency
  )

  if (upsertError) {
    console.error('[webhook/call_ended] calls upsert failed:', upsertError.message)
  }
}

/**
 * call_analyzed: enriches the calls row with transcript + summary, queues Inngest classification.
 * ALWAYS persists transcript before firing Inngest — never lose the transcript on OpenAI failure.
 * D-09: call_analysis.call_summary → calls.summary (NOT call.summary or call.analysis.summary)
 * D-05: UPSERT handles race where call_analyzed arrives before call_ended.
 */
export async function processCallAnalyzed(call: RetellCallPayload): Promise<void> {
  const db = createServiceRoleClient()

  // Always persist transcript + summary FIRST — even if Inngest send fails later
  const { data: callRow, error: upsertError } = await db
    .from('calls')
    .upsert(
      {
        retell_call_id: call.call_id,
        // D-09: call_analysis.call_summary is the field (NOT call.summary)
        summary: call.call_analysis?.call_summary ?? null,
        // Store transcript_object (structured array) in JSONB — NOT the plain transcript string
        transcript: call.transcript_object ?? null,
        recording_url: call.recording_url ?? null,
        // analysis_status stays 'analyzing' — Inngest classify job will set 'complete'
      },
      { onConflict: 'retell_call_id' }
    )
    .select('id, contractor_id')
    .maybeSingle()

  if (upsertError) {
    console.error('[webhook/call_analyzed] transcript upsert failed:', upsertError.message)
    return
  }
  if (!callRow) {
    console.error('[webhook/call_analyzed] no call row returned after upsert for call_id:', call.call_id)
    return
  }

  // D-08: Fire Inngest classification job — handles LLM retries on failure
  try {
    await inngest.send({
      name: 'retell/call.classify',
      data: {
        callId: callRow.id,
        contractorId: callRow.contractor_id,
        transcriptText: call.transcript ?? null,
        transcriptObject: call.transcript_object ?? null,
        durationMs: call.duration_ms ?? null,
      },
    })
  } catch (err) {
    console.error('[webhook/call_analyzed] inngest.send failed — classification will not run:', err instanceof Error ? err.message : err)
    // Do not re-throw — transcript is already persisted; Inngest failure is logged
    // The 30-minute timeout cron will mark this as analysis_failed if classify never runs
  }
}
