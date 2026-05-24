// src/lib/notifications/payment-alert.ts
// Payment failure alert helper — sends SMS and WhatsApp to contractor.
// D-05: Channel-flag gating — respects notify_sms_enabled / notify_whatsapp_enabled.
// D-11: "PAYMENT FAILED" alert sent before agent deactivation.
// BILL-03: Payment failure notification per CONTEXT.md decisions.
import 'server-only'
import { sendSms, type SendSmsParams } from './sms'
import { sendWhatsApp, type SendWhatsAppParams } from './whatsapp'
import { createServiceRoleClient } from '@/lib/supabase/service'

/**
 * Parameters for sendPaymentFailureAlert.
 *
 * D-05: Channel flags are resolved from notification_settings in the Inngest step
 * and passed in here — this function does NOT re-fetch from the DB.
 */
interface SendPaymentFailureAlertParams {
  contractorId: string
  /** Resolved SMS destination: notification_settings.sms_number ?? contractor.phone_number. Null if both are null. */
  smsNumber: string | null
  /** notification_settings.notify_sms_enabled. DEFAULT TRUE — existing contractors unaffected. */
  smsEnabled: boolean
  /** notification_settings.whatsapp_number. Null if not configured. */
  whatsappNumber: string | null
  /** notification_settings.notify_whatsapp_enabled. DEFAULT FALSE — opt-in channel. */
  whatsappEnabled: boolean
}

/**
 * Send payment failure alert to contractor via SMS and/or WhatsApp.
 *
 * D-05: Each channel is gated independently:
 * - SMS fires only when smsEnabled=true AND smsNumber is non-null.
 * - WhatsApp fires only when whatsappEnabled=true AND whatsappNumber is non-null.
 * Channel failures are isolated — a failed SMS does not suppress WhatsApp.
 *
 * D-11: Alert content uses "PAYMENT FAILED" prefix and fires BEFORE deactivation.
 *
 * @param contractorId - The contractor ID to alert
 * @param smsNumber - Resolved SMS destination (notification_settings.sms_number ?? phone_number)
 * @param smsEnabled - Whether SMS notifications are enabled for this contractor
 * @param whatsappNumber - WhatsApp destination number (notification_settings.whatsapp_number)
 * @param whatsappEnabled - Whether WhatsApp notifications are enabled for this contractor
 */
export async function sendPaymentFailureAlert({
  contractorId,
  smsNumber,
  smsEnabled,
  whatsappNumber,
  whatsappEnabled,
}: SendPaymentFailureAlertParams): Promise<void> {
  // Load contractor's callId (for logging) - use a generated ID since this isn't call-related
  const alertCallId = `payment-failure-${contractorId}-${Date.now()}`

  const smsBody = `VOICEDESK ALERT: Payment failed. Your agent will be deactivated within 72 hours. Update payment method at your account settings to keep service active.`

  // D-05 SMS gate: skip if disabled or no number — T-11-02-02: warn log for operator visibility
  if (!smsEnabled || !smsNumber) {
    console.warn(
      `[payment-alert] SMS skipped for contractor ${contractorId}: smsEnabled=${smsEnabled}, hasNumber=${!!smsNumber}`
    )
  } else {
    const smsParams: SendSmsParams = {
      to: smsNumber,
      body: smsBody,
      contractorId,
      callId: alertCallId,
    }

    console.log(
      `[payment-alert] Sending SMS payment failure alert to ${smsNumber}`
    )

    try {
      await sendSms(smsParams)
    } catch (err) {
      console.error(
        `[payment-alert] SMS send failed for contractor ${contractorId}:`,
        err instanceof Error ? err.message : err
      )
      // Continue even if SMS fails - WhatsApp might still work
    }
  }

  // D-05 WhatsApp gate: skip if disabled or no number.
  // DEFAULT FALSE — most contractors skip this silently; no warn log needed.
  if (whatsappEnabled && whatsappNumber) {
    const whatsappParams: SendWhatsAppParams = {
      to: whatsappNumber,
      templateType: 'emergency', // Reuse emergency template for payment failure
      callerPhone: 'PAYMENT FAILED', // D-11: Use "PAYMENT FAILED" per CONTEXT
      serviceRequested: 'Update payment method to keep service active',
      contractorId,
      callId: alertCallId,
    }

    console.log(
      `[payment-alert] Sending WhatsApp payment failure alert to ${whatsappNumber}`
    )

    try {
      await sendWhatsApp(whatsappParams)
    } catch (err) {
      console.error(
        `[payment-alert] WhatsApp send failed for contractor ${contractorId}:`,
        err instanceof Error ? err.message : err
      )
      // Don't throw - SMS may have already been sent
    }
  }

  // Log to notification_log for audit (T-07-05-01)
  await logPaymentAlertToDb({
    contractorId,
    smsNumber: smsEnabled ? smsNumber : null,
    smsSent: smsEnabled && !!smsNumber,
    whatsappNumber: whatsappEnabled ? whatsappNumber : null,
    whatsappSent: whatsappEnabled && !!whatsappNumber,
    smsBody,
  })

  console.log(
    `[payment-alert] Payment failure alert complete for contractor ${contractorId}`
  )
}

/**
 * Log payment alert to notification_log for audit trail.
 * Errors are suppressed — the alert itself was the critical path.
 */
async function logPaymentAlertToDb({
  contractorId,
  smsNumber,
  smsSent,
  whatsappNumber,
  whatsappSent,
  smsBody,
}: {
  contractorId: string
  smsNumber: string | null
  smsSent: boolean
  whatsappNumber: string | null
  whatsappSent: boolean
  smsBody: string
}): Promise<void> {
  const db = createServiceRoleClient()

  if (smsSent && smsNumber) {
    try {
      await db.from('notification_log').insert({
        contractor_id: contractorId,
        call_id: null,
        channel: 'sms',
        recipient: smsNumber,
        message: smsBody,
        status: 'sent',
      })
    } catch (err) {
      // Ignore duplicate errors
      console.warn(
        `[payment-alert] SMS notification log insert failed for contractor ${contractorId}`
      )
    }
  }

  if (whatsappSent && whatsappNumber) {
    try {
      await db.from('notification_log').insert({
        contractor_id: contractorId,
        call_id: null,
        channel: 'whatsapp',
        recipient: whatsappNumber,
        message: 'Payment failure WhatsApp alert',
        status: 'sent',
      })
    } catch (err) {
      console.warn(
        `[payment-alert] WhatsApp notification log insert failed for contractor ${contractorId}`
      )
    }
  }
}
