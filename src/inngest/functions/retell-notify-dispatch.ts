// src/inngest/functions/retell-notify-dispatch.ts
// Durable Inngest function for multi-channel notification dispatch.
// D-01: Triggered by 'retell/call.notify' event fired from retell-call-classify.
// D-02: Event payload is minimal {callId, contractorId} — function loads all data from DB.
// D-03: Fires after every classification including no_action; filtering inside this function.
// D-04: Idempotency key: retell-notify-${callId}.
// D-08: Promise.allSettled for multi-channel — one failure cannot block others.
// D-09: WhatsApp failure → SMS fallback within same invocation.
// D-12: notification_log row written before send (pending), updated after (sent/failed).
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendSms } from '@/lib/notifications/sms'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'
import { sendTelegram } from '@/lib/notifications/telegram'
import { writeNotificationLog, updateNotificationLog } from '@/lib/notifications/log'

export const retellNotifyDispatch = inngest.createFunction(
  {
    id: 'retell-notify-dispatch',
    retries: 5,
    triggers: [{ event: 'retell/call.notify' }],
    onFailure: async ({ event }) => {
      const { callId, contractorId } = event.data.event.data as { callId: string; contractorId: string }
      console.error('[voicedesk]', JSON.stringify({
        event: 'retell-notify-dispatch.failed',
        contractor_id: contractorId,
        call_id: callId,
        error: 'all retries exhausted',
      }))
      // notification_log rows already written per-attempt — no additional DB update needed
    },
  },
  async ({ event, step }) => {
    const { callId, contractorId } = event.data as {
      callId: string
      contractorId: string
    }

    if (!callId || !contractorId) {
      throw new NonRetriableError(
        `[retell-notify-dispatch] invalid event data: missing callId or contractorId`
      )
    }

    // Step 1: Load all required data from DB
    // D-02: Payload is minimal {callId, contractorId} — load fresh data here to avoid stale payloads
    const notifyData = await step.run('load-notification-data', async () => {
      const db = createServiceRoleClient()

      const [callResult, leadResult, settingsResult] = await Promise.all([
        db.from('calls').select('caller_phone, intent, summary').eq('id', callId).maybeSingle(),
        db.from('leads').select('id, service_requested, status, booking_conflict').eq('call_id', callId).maybeSingle(),
        db.from('notification_settings')
          .select('sms_number, whatsapp_number, telegram_chat_id, notify_on_lead, notify_on_emergency, notify_on_general_inquiry')
          .eq('contractor_id', contractorId)
          .maybeSingle(),
      ])

      if (callResult.error || !callResult.data) {
        throw new NonRetriableError(`[retell-notify-dispatch] call ${callId} not found`)
      }

      return {
        call: callResult.data,
        lead: leadResult.data ?? null,
        settings: settingsResult.data ?? null,
      }
    })

    const { call, lead, settings } = notifyData
    const intent = call.intent as string | null

    // D-03: Filter — skip all sends for no_action (hang-ups, wrong numbers, spam)
    // D-05: SMS fires for lead/emergency/info. Skipped for no_action.
    if (!intent || intent === 'no_action') {
      return
    }

    // D-05: Determine which channels fire
    const shouldSendSms = settings?.sms_number != null
    const isLeadOrEmergency = intent === 'lead' || intent === 'emergency'
    const isInfoWithOptIn = intent === 'info' && settings?.notify_on_general_inquiry === true
    // D-06: WhatsApp + Telegram fire for lead/emergency; also info when notify_on_general_inquiry=true
    const shouldSendWhatsApp = settings?.whatsapp_number != null && (isLeadOrEmergency || isInfoWithOptIn)
    const shouldSendTelegram = settings?.telegram_chat_id != null && (isLeadOrEmergency || isInfoWithOptIn)

    const callerPhone = call.caller_phone ?? 'Unknown'
    const serviceRequested = lead?.service_requested ?? call.summary ?? 'General inquiry'
    const isEmergency = intent === 'emergency'

    // Build booking status string for WhatsApp new_lead template (D-14)
    let bookingStatus = 'No appointment booked'
    if (lead?.status === 'booked') {
      bookingStatus = 'Appointment booked'
    } else if (lead?.booking_conflict) {
      bookingStatus = 'Booking conflict — please call back'
    }

    // EMRG-03: Emergency SMS body includes "EMERGENCY" prominently
    // NOTIF-01: SMS body for non-emergency: "New call from [phone] — [issue]. [booking status]."
    const smsBody = isEmergency
      ? `EMERGENCY: New call from ${callerPhone} — ${serviceRequested}. Call back immediately.`
      : `New call from ${callerPhone} — ${serviceRequested}. ${bookingStatus}.`

    // Plain-text Telegram message (no template approval needed)
    const telegramMessage = isEmergency
      ? `⚠️ EMERGENCY: New call from ${callerPhone} — ${serviceRequested}. Call back immediately.`
      : `📞 New call from ${callerPhone} — ${serviceRequested}. ${bookingStatus}.`

    // Step 2: Dispatch all configured channels via Promise.allSettled (D-08)
    await step.run('dispatch-notifications', async () => {
      const sends: Promise<void>[] = []

      // SMS dispatch (D-05: lead/emergency/info)
      if (shouldSendSms) {
        sends.push(
          (async () => {
            const logId = await writeNotificationLog({
              contractorId,
              callId,
              channel: 'sms',
              recipient: settings!.sms_number!,
              message: smsBody,
            })
            try {
              await sendSms({
                to: settings!.sms_number!,
                body: smsBody,
                contractorId,
                callId,
              })
              await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
            } catch (err: unknown) {
              await updateNotificationLog(logId, {
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
              })
              throw err  // Re-throw so Promise.allSettled captures the failure
            }
          })()
        )
      }

      // WhatsApp dispatch (D-06: lead/emergency + info if opted-in; D-09: fallback on failure)
      if (shouldSendWhatsApp) {
        sends.push(
          (async () => {
            const templateType = isEmergency ? 'emergency' : 'new_lead'
            const logId = await writeNotificationLog({
              contractorId,
              callId,
              channel: 'whatsapp',
              recipient: settings!.whatsapp_number!,
              message: `[template:${templateType}] ${callerPhone} / ${serviceRequested}`,
            })
            try {
              await sendWhatsApp({
                to: settings!.whatsapp_number!,
                templateType,
                callerPhone,
                serviceRequested,
                bookingStatus: templateType === 'new_lead' ? bookingStatus : undefined,
                contractorId,
                callId,
              })
              await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
            } catch (err: unknown) {
              await updateNotificationLog(logId, {
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
              })
              // D-09: WhatsApp failure → SMS fallback (if sms_number configured)
              if (settings?.sms_number) {
                const fallbackLogId = await writeNotificationLog({
                  contractorId,
                  callId,
                  channel: 'sms',
                  recipient: settings.sms_number,
                  message: `[WA fallback] ${smsBody}`,
                })
                try {
                  await sendSms({
                    to: settings.sms_number,
                    body: smsBody,
                    contractorId,
                    callId,
                  })
                  await updateNotificationLog(fallbackLogId, { status: 'sent', sentAt: new Date().toISOString() })
                } catch (fallbackErr: unknown) {
                  await updateNotificationLog(fallbackLogId, {
                    status: 'failed',
                    error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
                  })
                  // Fallback also failed — logged; do not throw (D-08: allSettled semantics)
                }
              }
              // Original WhatsApp error is swallowed here — fallback attempted (D-09)
            }
          })()
        )
      }

      // Telegram dispatch (D-06: lead/emergency + info if opted-in)
      if (shouldSendTelegram) {
        sends.push(
          (async () => {
            const logId = await writeNotificationLog({
              contractorId,
              callId,
              channel: 'telegram',
              recipient: settings!.telegram_chat_id!,
              message: telegramMessage,
            })
            try {
              await sendTelegram({
                chatId: settings!.telegram_chat_id!,
                message: telegramMessage,
                contractorId,
                callId,
              })
              await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
            } catch (err: unknown) {
              await updateNotificationLog(logId, {
                status: 'failed',
                error: err instanceof Error ? err.message : String(err),
              })
              throw err
            }
          })()
        )
      }

      // D-08: Promise.allSettled — one channel failure does NOT block others
      const results = await Promise.allSettled(sends)
      const failures = results.filter(r => r.status === 'rejected')
      if (failures.length > 0) {
        const errorMessages = failures
          .map(r => (r as PromiseRejectedResult).reason instanceof Error
            ? (r as PromiseRejectedResult).reason.message
            : String((r as PromiseRejectedResult).reason))
          .join('; ')
        console.error(`[retell-notify-dispatch] ${failures.length} channel(s) failed for call ${callId}: ${errorMessages}`)
        // Re-throw to trigger Inngest retry (retries: 5)
        // On retry, notification_log already has failed rows — new rows will be created for the retry attempt
        throw new Error(`Notification dispatch partial failure: ${errorMessages}`)
      }
    })
  }
)
