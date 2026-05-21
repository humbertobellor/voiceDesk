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
import { getCalendarClient } from '@/lib/google/auth'
import { computeAvailableSlots } from '@/lib/scheduling/slots'
import { buildSystemPrompt, buildBeginMessage } from '@/lib/retell/system-prompt'
import { addMinutes } from 'date-fns'
import { fromZonedTime } from 'date-fns-tz'
import type { ContractorSettings } from '@/types/database'

export const retellCallClassify = inngest.createFunction(
  {
    id: 'retell-call-classify',
    retries: 5, // D-08 pattern: max 5 retries, same as retell-agent-sync
    triggers: [{ event: 'retell/call.classify' }],
    onFailure: async ({ event }) => {
      // All retries exhausted — mark call as analysis_failed so portal can show "Analysis unavailable"
      // event.data.event is the FailureEventPayload; .data is the original retell/call.classify payload
      const { callId, contractorId } = event.data.event.data as { callId: string; contractorId: string }
      if (!callId) return
      const db = createServiceRoleClient()
      await db
        .from('calls')
        .update({ analysis_status: 'analysis_failed' })
        .eq('id', callId)
      // Phase 4 extension: also set google_sync_status='failed' on any pending appointments for this call
      await db.from('appointments')
        .update({ google_sync_status: 'failed' })
        .eq('call_id', callId)
        .eq('google_sync_status', 'pending')
      console.error('[voicedesk]', JSON.stringify({
        event: 'retell-call-classify.failed',
        contractor_id: contractorId,
        call_id: callId,
        error: 'all retries exhausted',
      }))
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

    // Step 0: Load contractor + settings — needed for slot computation, agent sync, and timezone (Risk 5)
    const contractor = await step.run('load-contractor', async () => {
      const db = createServiceRoleClient()
      const { data, error } = await db
        .from('contractors')
        .select('id, retell_llm_id, timezone, contractor_settings(*)')
        .eq('id', contractorId)
        .maybeSingle()
      if (error || !data) {
        throw new NonRetriableError(
          `[retell-call-classify] contractor ${contractorId} not found`
        )
      }
      return data
    })
    const settings = contractor.contractor_settings as unknown as ContractorSettings | null
    const contractorTimezone = contractor.timezone ?? 'America/New_York'

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

    // Step 5: Create lead record (D-12)
    // shouldCreate: lead/emergency always; info only if call >= 15s; no_action → null (no DB write)
    const lead = await step.run('create-lead', async () => {
      const shouldCreate =
        finalIntent === 'lead' ||
        finalIntent === 'emergency' ||
        (finalIntent === 'info' && (durationMs ?? 0) >= 15000)

      if (!shouldCreate) return null

      const db = createServiceRoleClient()
      const hasAppointment = !!(tradeData as { confirmed_appointment_time?: string | null })?.confirmed_appointment_time

      // Load caller details from calls row (set during Phase 3 webhook handler)
      const { data: callRow } = await db
        .from('calls')
        .select('caller_name, caller_phone')
        .eq('id', callId)
        .maybeSingle()

      const { data, error } = await db.from('leads').insert({
        contractor_id: contractorId,
        call_id: callId,
        caller_name: callRow?.caller_name ?? null,
        caller_phone: callRow?.caller_phone ?? '',
        service_requested: (tradeData as { issue_description?: string | null; repair_type?: string | null })?.issue_description
          ?? (tradeData as { repair_type?: string | null })?.repair_type
          ?? null,
        urgency: (tradeData as { urgency?: string })?.urgency ?? 'normal',
        status: hasAppointment ? 'booked' : 'new',
        notes: (tradeData as { service_address?: string | null })?.service_address
          ? `Service address: ${(tradeData as { service_address?: string | null }).service_address}`
          : null,
      }).select('id').maybeSingle()

      if (error) {
        console.error('[retell-call-classify] create-lead failed:', error.message)
        throw new Error(error.message)
      }
      return data
    })

    // Step 6: Create appointment record (D-09, D-10)
    // Only runs when confirmed_appointment_time was extracted (SCHED-03)
    const appointment = await step.run('create-appointment', async () => {
      const rawTime = (tradeData as { confirmed_appointment_time?: string | null })?.confirmed_appointment_time
      if (!rawTime) return null

      // Risk 4: Strip trailing 'Z' — treat extracted time as contractor local time, not UTC
      const localStr = rawTime.replace(/Z$/, '')
      if (isNaN(Date.parse(localStr))) {
        console.warn('[retell-call-classify] create-appointment: invalid confirmed_appointment_time from LLM:', rawTime)
        return null
      }

      // Convert contractor-local datetime to UTC for DB storage
      const startsAt = fromZonedTime(new Date(localStr), contractorTimezone)
      const durationMin = (settings as ContractorSettings | null)?.appointment_duration_minutes ?? 120
      const endsAt = addMinutes(startsAt, durationMin)

      const db = createServiceRoleClient()
      const { data, error } = await db.from('appointments').insert({
        contractor_id: contractorId,
        lead_id: lead?.id ?? null,
        call_id: callId,
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
        service_address: (tradeData as { service_address?: string | null })?.service_address ?? null,
        google_sync_status: 'pending',
      }).select('id, starts_at, ends_at').maybeSingle()

      if (error) {
        if (error.code === '23505') {
          // D-10: UNIQUE(contractor_id, starts_at) violated — slot already taken by another call.
          // Mark the LEAD as booking_conflict=true (NOT appointments — UNIQUE prevents a second row).
          // Contractor sees this lead in Phase 6 portal and calls back the customer.
          console.warn('[retell-call-classify] create-appointment: booking conflict for slot', localStr)
          if (lead?.id) {
            await db.from('leads')
              .update({ booking_conflict: true, status: 'new' })
              .eq('id', lead.id)
          }
          return null
        }
        console.error('[retell-call-classify] create-appointment failed:', error.message)
        throw new Error(error.message)
      }
      return data
    })

    // Step 7: Create Google Calendar event (D-13, D-14, D-15)
    await step.run('create-calendar-event', async () => {
      if (!appointment) return  // No appointment (null confirmed_appointment_time or booking conflict)

      const calendarClient = await getCalendarClient(contractorId)
      const db = createServiceRoleClient()

      if (!calendarClient) {
        // D-15: No calendar connected — set status to skipped and continue
        await db.from('appointments')
          .update({ google_sync_status: 'skipped' })
          .eq('id', appointment.id)
        return
      }

      const serviceAddr = (tradeData as { service_address?: string | null })?.service_address ?? 'TBD'
      const businessName = (settings as ContractorSettings | null)?.business_name ?? 'Contractor'

      // Load lead for caller details
      const { data: leadRow } = lead?.id
        ? await db.from('leads').select('caller_name, caller_phone, service_requested').eq('id', lead.id).maybeSingle()
        : { data: null }

      try {
        const response = await calendarClient.events.insert({
          calendarId: 'primary',
          sendUpdates: 'none',  // D: Do NOT email attendees — prevents attendee spoofing (T-04-05-05)
          requestBody: {
            summary: `${businessName} — Estimate`,
            description: [
              `Caller: ${leadRow?.caller_name ?? 'Unknown'} (${leadRow?.caller_phone ?? ''})`,
              `Service: ${leadRow?.service_requested ?? 'General'}`,
              `Address: ${serviceAddr}`,
              `Booked via VoiceDesk`,
            ].join('\n'),
            start: {
              dateTime: appointment.starts_at,
              timeZone: contractorTimezone,
            },
            end: {
              dateTime: appointment.ends_at,
              timeZone: contractorTimezone,
            },
          },
        })

        // D-14: Update appointment with google_event_id and synced status
        await db.from('appointments').update({
          google_event_id: response.data.id ?? null,
          google_sync_status: 'synced',
        }).eq('id', appointment.id)
      } catch (err: unknown) {
        console.error('[retell-call-classify] create-calendar-event failed:', err instanceof Error ? err.message : err)
        // Re-throw so Inngest retries (up to 5 times via function-level retries setting)
        throw err
      }
    })

    // Step 8a: Compute updated slot list for system prompt rebuild (memoized DB query)
    const syncPayload = await step.run('compute-sync-payload', async () => {
      if (!settings || !contractor.retell_llm_id) return null

      // Load existing appointments to compute fresh available slots
      const db = createServiceRoleClient()
      const { data: existingAppts } = await db
        .from('appointments')
        .select('starts_at')
        .eq('contractor_id', contractorId)
      const existingStarts = (existingAppts ?? []).map(a => new Date(a.starts_at))
      const updatedSlots = computeAvailableSlots({
        businessHours: (settings as ContractorSettings).business_hours,
        appointmentDurationMinutes: (settings as ContractorSettings).appointment_duration_minutes ?? 120,
        existingStarts,
        timezone: contractorTimezone,
      })

      return {
        contractorId,
        llmId: contractor.retell_llm_id,
        compiledPrompt: buildSystemPrompt(settings as ContractorSettings, updatedSlots),
        beginMessage: buildBeginMessage(settings as ContractorSettings),
      }
    })

    // Step 8b: Trigger system prompt rebuild (D-08) — step.sendEvent is memoized on retry
    if (syncPayload) {
      await step.sendEvent('trigger-agent-sync', {
        name: 'retell/agent.sync',
        data: syncPayload,
      })
    }

    // Step 9: Fire retell/call.notify event (Phase 5 Notifications)
    // D-01: retell-notify-dispatch handles all notification logic independently.
    // D-03: Fires after every classification — filtering by intent inside retell-notify-dispatch.
    // D-04: Idempotency via event `id` field — Inngest deduplicates events with the same id at send time.
    await step.sendEvent('trigger-notify', {
      name: 'retell/call.notify',
      id: `retell-notify-${callId}`,
      data: { callId, contractorId },
    })
  }
)
