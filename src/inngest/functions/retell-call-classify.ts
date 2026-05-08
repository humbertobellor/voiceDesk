// src/inngest/functions/retell-call-classify.ts
// Durable Inngest function for two-step LLM classification of completed calls.
// D-08: step 1 = GPT-4o-mini intent classification, step 2 = GPT-4o trade extraction.
// D-06: Hard-coded emergency keywords checked FIRST — result overrides LLM if triggered.
// D-13: isShortCall flag passed to classifier for calls < 15 seconds duration.
// retries: 5 — Inngest default exponential backoff (~1min, ~2min, ~4min, ~8min, ~16min).
// onFailure: set analysis_status='analysis_failed' when all retries exhausted.
// Triggered by: inngest.send({ name: 'retell/call.classify', data: { callId, contractorId, transcriptText, durationMs } })
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { hasHardEmergencyKeyword } from '@/lib/classification/emergency-keywords'
import { classifyIntent } from '@/lib/classification/classify-intent'
import { extractTradeData } from '@/lib/classification/extract-trade'

export const retellCallClassify = inngest.createFunction(
  {
    id: 'retell-call-classify',
    retries: 5, // D-08 pattern: max 5 retries, same as retell-agent-sync
    triggers: [{ event: 'retell/call.classify' }],
    onFailure: async ({ event }) => {
      // All retries exhausted — mark call as analysis_failed so portal can show "Analysis unavailable"
      // event.data.event is the FailureEventPayload; .data is the original retell/call.classify payload
      const { callId } = event.data.event.data as { callId: string }
      if (!callId) return
      const db = createServiceRoleClient()
      await db
        .from('calls')
        .update({ analysis_status: 'analysis_failed' })
        .eq('id', callId)
    },
  },
  async ({ event, step }) => {
    const { callId, contractorId, transcriptText, durationMs } = event.data as {
      callId: string
      contractorId: string
      transcriptText: string | null
      durationMs: number | null
    }

    // Validate required fields — NonRetriableError if event data is corrupt
    if (!callId || !contractorId) {
      throw new NonRetriableError(
        `[retell-call-classify] invalid event data: missing callId or contractorId`
      )
    }

    const safeTranscript = transcriptText ?? ''

    // Step 1: Hard-coded emergency check (D-06, EMRG-02)
    // This check is synchronous and cannot be overridden by any LLM result
    const hardEmergency = await step.run('check-hard-emergency', async () => {
      return hasHardEmergencyKeyword(safeTranscript)
    })

    // Step 2: LLM intent classification (D-07, CALL-02)
    // isShortCall = true for calls < 15 seconds — LLM uses this context to return no_action (D-13)
    const classification = await step.run('classify-intent', async () => {
      const isShortCall = (durationMs ?? 0) < 15000
      return classifyIntent(safeTranscript, isShortCall)
    })

    // D-06: Hard emergency overrides LLM result — EMRG-02 compliance
    const finalIntent = hardEmergency ? 'emergency' : classification.intent

    // Step 3: Trade-specific extraction (D-08, CALL-03)
    // Skip extraction for no_action calls to avoid wasted API cost (D-13)
    const tradeData = await step.run('extract-trade-data', async () => {
      if (finalIntent === 'no_action') return null
      return extractTradeData(safeTranscript, classification.detected_trade ?? undefined)
    })

    // Step 4: Write final classification to DB (D-03: status → 'complete')
    await step.run('persist-classification', async () => {
      const db = createServiceRoleClient()
      const { error } = await db
        .from('calls')
        .update({
          intent: finalIntent,
          raw_metadata: tradeData,
          analysis_status: 'complete',
        })
        .eq('id', callId)
      if (error) {
        console.error('[retell-call-classify] persist-classification failed:', error.message)
        throw new Error(error.message)
      }
    })
  }
)
