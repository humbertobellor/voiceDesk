// src/inngest/functions/retell-notify-dispatch.ts
// Durable Inngest function for multi-channel notification dispatch.
// D-01: Triggered by 'retell/call.notify' event fired from retell-call-classify.
// D-02: Event payload is minimal {callId, contractorId} — function loads all data from DB.
// D-03: Fires after every classification including no_action; filtering inside this function.
// D-04: Idempotency key: retell-notify-${callId}.
// D-08: Each channel runs in its own step.run() — Inngest memoizes independently, one failure retries only that channel.
// D-09: WhatsApp failure → SMS fallback within same invocation.
// D-12: notification_log row written before send (pending), updated after (sent/failed).
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { sendSms } from '@/lib/notifications/sms'
import { sendWhatsApp } from '@/lib/notifications/whatsapp'
import { sendTelegram } from '@/lib/notifications/telegram'
import { sendEmail } from '@/lib/notifications/email'
import { writeNotificationLog, updateNotificationLog } from '@/lib/notifications/log'
import { render } from '@react-email/render'
import { LeadNotificationEmail } from '@/lib/notifications/templates/LeadNotificationEmail'
import { EmergencyNotificationEmail } from '@/lib/notifications/templates/EmergencyNotificationEmail'
import type { CallIntent, NotificationSettings } from '@/types/database'

/**
 * Pure function that computes which notification channels should fire for a given
 * call intent and contractor notification settings.
 *
 * Extracted to allow unit testing without the Inngest runtime.
 *
 * @param settings - Contractor notification settings row (null if not configured).
 * @param intent   - Classified call intent (null or 'no_action' → no channels fire).
 * @returns        Object with boolean flags for each channel, including email.
 */
export function computeChannels(
  settings: Pick<
    NotificationSettings,
    | 'sms_number'
    | 'whatsapp_number'
    | 'telegram_chat_id'
    | 'notify_on_lead'
    | 'notify_on_emergency'
    | 'notify_on_general_inquiry'
    | 'notify_sms_enabled'
    | 'notify_whatsapp_enabled'
    | 'notify_telegram_enabled'
    | 'notify_email_enabled'
    | 'email_address'
  > | null,
  intent: CallIntent | null
): { shouldSendSms: boolean; shouldSendWhatsApp: boolean; shouldSendTelegram: boolean; shouldSendEmail: boolean } {
  if (!intent || intent === 'no_action' || intent === 'unknown') {
    if (intent === 'unknown') {
      console.warn('[voicedesk]', JSON.stringify({
        event: 'retell-notify-dispatch.skipped_unknown_intent',
      }))
    }
    return { shouldSendSms: false, shouldSendWhatsApp: false, shouldSendTelegram: false, shouldSendEmail: false }
  }

  const isInfoWithOptIn = intent === 'info' && settings?.notify_on_general_inquiry === true

  const shouldSendSms =
    settings?.sms_number != null &&
    settings?.notify_sms_enabled === true &&
    (
      (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
      (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
      (intent === 'info'      && (settings.notify_on_general_inquiry === true))
    )

  const shouldSendWhatsApp =
    settings?.whatsapp_number != null &&
    settings?.notify_whatsapp_enabled === true &&
    (
      (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
      (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
      isInfoWithOptIn
    )

  const shouldSendTelegram =
    settings?.telegram_chat_id != null &&
    settings?.notify_telegram_enabled === true &&
    (
      (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
      (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
      isInfoWithOptIn
    )

  // D-05 / EMAIL-02 / EMAIL-03: Email channel gate.
  // Triple condition: address present AND channel enabled AND intent matches preference.
  // email_address=null → false (regardless of flag), notify_email_enabled=false → false.
  const shouldSendEmail =
    settings?.email_address != null &&
    settings?.notify_email_enabled === true &&
    (
      (intent === 'emergency' && (settings.notify_on_emergency ?? true)) ||
      (intent === 'lead'      && (settings.notify_on_lead      ?? true)) ||
      isInfoWithOptIn
    )

  return { shouldSendSms, shouldSendWhatsApp, shouldSendTelegram, shouldSendEmail }
}

/** Valid event_type values for app_notifications (mirrors DB CHECK constraint). */
export type BellEventType = 'lead' | 'emergency' | 'system'

/** Row shape for an app_notifications bell notification. */
export interface BellNotification {
  event_type: BellEventType
  title: string
  body: string
}

/**
 * Pure function that formats a call event into a bell notification row for
 * app_notifications. Maps the five CallIntent cases to the three allowed
 * event_type values and constructs title/body strings.
 *
 * Extracted to allow unit testing without the Inngest runtime (matches the
 * computeChannels pattern above).
 *
 * @param intent            - Classified call intent (null / no_action / unknown → system).
 * @param callerPhone       - Caller's phone number string (may be 'Unknown').
 * @param serviceType       - Service requested or call summary.
 * @param appointmentStatus - Booking status string for the lead body line.
 * @returns BellNotification with event_type, title, and body. Never throws.
 */
export function computeBellNotification(
  intent: CallIntent | null,
  callerPhone: string,
  serviceType: string,
  appointmentStatus: string
): BellNotification {
  if (intent === 'emergency') {
    return {
      event_type: 'emergency',
      title: `EMERGENCY: New call from ${callerPhone}`,
      body: `${callerPhone} • ${serviceType}`,
    }
  }
  if (intent === 'lead') {
    return {
      event_type: 'lead',
      title: `New lead — ${serviceType}`,
      body: `${callerPhone} • ${appointmentStatus}`,
    }
  }
  // intent='info', null, 'no_action', 'unknown', or any other value → system
  return {
    event_type: 'system',
    title: `General inquiry from ${callerPhone}`,
    body: `${callerPhone} • ${serviceType}`,
  }
}

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
          .select('sms_number, whatsapp_number, telegram_chat_id, notify_email_enabled, email_address, notify_on_lead, notify_on_emergency, notify_on_general_inquiry, notify_sms_enabled, notify_whatsapp_enabled, notify_telegram_enabled')
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
    // WR-04: Use narrow CallIntent union so tsc flags unhandled intents when new values are added
    const intent = call.intent as CallIntent | null

    // D-03: Filter — skip all sends for no_action (hang-ups, wrong numbers, spam)
    // D-04: CR-04: computeChannels gates each channel on intent AND contractor's per-intent prefs.
    // Preference fields default to true for lead/emergency (opt-out model) and false for info (opt-in).
    const { shouldSendSms, shouldSendWhatsApp, shouldSendTelegram, shouldSendEmail } = computeChannels(settings, intent)

    // D-04/BELL-01: hasValidIntent determines whether a bell row should be written.
    // Bell writes occur for lead/emergency/info regardless of channel-enable flags.
    const hasValidIntent = intent === 'lead' || intent === 'emergency' || intent === 'info'

    // T-13-03-02: Guard must check ALL four channels. Omitting shouldSendEmail would cause
    // email-only contractors (no SMS/WhatsApp/Telegram) to silently receive no notifications.
    // Restructured: only exit early when there is no valid intent AND all channels are off.
    // Valid-intent calls always reach write-bell-notification even with all channels disabled.
    if (!hasValidIntent && !shouldSendSms && !shouldSendWhatsApp && !shouldSendTelegram && !shouldSendEmail) {
      // intent is no_action/unknown AND all channels are disabled — nothing to do
      return
    }

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

    // BELL-01/BELL-04: Write bell row to app_notifications for every valid call intent.
    // This step is unconditional — runs before channel dispatch regardless of channel flags.
    // no_action/unknown calls are skipped via the hasValidIntent guard inside the step.
    // T-14-02-01: contractor_id sourced from function scope (event.data), never from webhook.
    // T-14-02-02: computeBellNotification only returns CHECK-valid event_type values.
    await step.run('write-bell-notification', async () => {
      if (!hasValidIntent) {
        // no_action/unknown — no bell row (invalid event_type for DB CHECK constraint)
        return
      }
      const bell = computeBellNotification(intent, callerPhone, serviceRequested, bookingStatus)
      const db = createServiceRoleClient()
      const { error } = await db.from('app_notifications').insert({
        contractor_id: contractorId,
        event_type: bell.event_type,
        title: bell.title,
        body: bell.body,
        is_read: false,
      })
      if (error) {
        // Throw so Inngest retries this step (T-14-02-03: up to 5 retries)
        throw new Error(`[write-bell-notification] DB insert failed: ${error.message}`)
      }
    })

    // EMRG-03: Emergency SMS body includes "EMERGENCY" prominently
    // NOTIF-01: SMS body for non-emergency: "New call from [phone] — [issue]. [booking status]."
    const smsBody = isEmergency
      ? `EMERGENCY: New call from ${callerPhone} — ${serviceRequested}. Call back immediately.`
      : `New call from ${callerPhone} — ${serviceRequested}. ${bookingStatus}.`

    // Plain-text Telegram message (no template approval needed)
    const telegramMessage = isEmergency
      ? `⚠️ EMERGENCY: New call from ${callerPhone} — ${serviceRequested}. Call back immediately.`
      : `📞 New call from ${callerPhone} — ${serviceRequested}. ${bookingStatus}.`

    // CR-01: Each channel runs in its own step.run() so Inngest memoizes them independently.
    // A failure in one channel only retries that channel — already-sent channels are skipped on retry.

    // SMS dispatch (D-05: lead/emergency/info, gated by intent prefs)
    if (shouldSendSms) {
      await step.run('send-sms', async () => {
        // WR-02: writeNotificationLog is inside the try/catch so a DB failure on insert
        // does not leave an orphaned 'pending' row on retry (logId would be null, skipping update).
        let logId: string | null = null
        try {
          logId = await writeNotificationLog({
            contractorId,
            callId,
            channel: 'sms',
            recipient: settings!.sms_number!,
            message: smsBody,
          })
          await sendSms({
            to: settings!.sms_number!,
            body: smsBody,
            contractorId,
            callId,
          })
          await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
        } catch (err: unknown) {
          if (logId) {
            await updateNotificationLog(logId, {
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            })
          }
          throw err  // Re-throw so Inngest retries this step
        }
      })
    }

    // WhatsApp dispatch (D-06: lead/emergency + info if opted-in; D-09: fallback on failure)
    if (shouldSendWhatsApp) {
      await step.run('send-whatsapp', async () => {
        const templateType = isEmergency ? 'emergency' : 'new_lead'
        // WR-02: writeNotificationLog is inside the try/catch so a DB failure on insert
        // does not leave an orphaned 'pending' row on retry (logId would be null, skipping update).
        let logId: string | null = null
        try {
          logId = await writeNotificationLog({
            contractorId,
            callId,
            channel: 'whatsapp',
            recipient: settings!.whatsapp_number!,
            message: `[template:${templateType}] ${callerPhone} / ${serviceRequested}`,
          })
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
          if (logId) {
            await updateNotificationLog(logId, {
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            })
          }
          // D-09: WhatsApp failure → SMS fallback ONLY when no primary SMS was already dispatched (CR-02).
          // If shouldSendSms=true, the contractor already received (or will receive) a primary SMS.
          if (settings?.sms_number && !shouldSendSms) {
            let fallbackLogId: string | null = null
            try {
              fallbackLogId = await writeNotificationLog({
                contractorId,
                callId,
                channel: 'sms',
                recipient: settings.sms_number,
                message: `[WA fallback] ${smsBody}`,
              })
              await sendSms({
                to: settings.sms_number,
                body: smsBody,
                contractorId,
                callId,
              })
              await updateNotificationLog(fallbackLogId, { status: 'sent', sentAt: new Date().toISOString() })
            } catch (fallbackErr: unknown) {
              if (fallbackLogId) {
                await updateNotificationLog(fallbackLogId, {
                  status: 'failed',
                  error: fallbackErr instanceof Error ? fallbackErr.message : String(fallbackErr),
                })
              }
              // CR-03: Fallback also failed — re-throw so Inngest retries this step
              throw fallbackErr
            }
          } else {
            // No fallback possible (or primary SMS already covers the contractor): re-throw original error
            throw err
          }
        }
      })
    }

    // Telegram dispatch (D-06: lead/emergency + info if opted-in)
    if (shouldSendTelegram) {
      await step.run('send-telegram', async () => {
        // WR-02: writeNotificationLog is inside the try/catch so a DB failure on insert
        // does not leave an orphaned 'pending' row on retry (logId would be null, skipping update).
        let logId: string | null = null
        try {
          logId = await writeNotificationLog({
            contractorId,
            callId,
            channel: 'telegram',
            recipient: settings!.telegram_chat_id!,
            message: telegramMessage,
          })
          await sendTelegram({
            chatId: settings!.telegram_chat_id!,
            message: telegramMessage,
            contractorId,
            callId,
          })
          await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
        } catch (err: unknown) {
          if (logId) {
            await updateNotificationLog(logId, {
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            })
          }
          throw err  // Re-throw so Inngest retries this step
        }
      })
    }

    // Email dispatch (EMAIL-02 / EMAIL-03: lead/emergency/info, gated by intent prefs + address)
    // D-06: Static imports at file top — not dynamic imports inside step.run.
    if (shouldSendEmail) {
      await step.run('send-email', async () => {
        // WR-02: writeNotificationLog is inside the try/catch so a DB failure on insert
        // does not leave an orphaned 'pending' row on retry (logId would be null, skipping update).
        let logId: string | null = null
        try {
          const dashboardUrl = `${process.env.NEXT_PUBLIC_APP_URL}/dashboard/calls`

          const emailSubject = isEmergency
            ? `EMERGENCY: New call from ${callerPhone}`
            : `New lead from ${callerPhone} — ${serviceRequested}`

          // render() from @react-email/render v2.x is async (returns Promise<string>)
          const emailHtml = await render(
            isEmergency
              ? EmergencyNotificationEmail({ callerPhone, serviceRequested, dashboardUrl })
              : LeadNotificationEmail({ callerPhone, serviceRequested, appointmentStatus: bookingStatus, dashboardUrl })
          )

          logId = await writeNotificationLog({
            contractorId,
            callId,
            channel: 'email',
            recipient: settings!.email_address!,
            message: emailSubject,
          })

          const result = await sendEmail({
            to: settings!.email_address!,
            subject: emailSubject,
            html: emailHtml,
          })

          if (!result.success) {
            throw new Error(result.error || 'sendEmail failed')
          }

          await updateNotificationLog(logId, { status: 'sent', sentAt: new Date().toISOString() })
        } catch (err: unknown) {
          if (logId) {
            await updateNotificationLog(logId, {
              status: 'failed',
              error: err instanceof Error ? err.message : String(err),
            })
          }
          throw err  // Re-throw so Inngest retries this step
        }
      })
    }
  }
)
