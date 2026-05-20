// src/lib/notifications/payment-alert.ts
// Payment failure alert helper — sends SMS and WhatsApp to contractor.
// D-11: "PAYMENT FAILED" alert sent before agent deactivation.
// BILL-03: Payment failure notification per CONTEXT.md decisions.
import 'server-only'
import { sendSms, type SendSmsParams } from './sms'
import { sendWhatsApp, type SendWhatsAppParams } from './whatsapp'
import { createServiceRoleClient } from '@/lib/supabase/service'

interface SendPaymentFailureAlertParams {
  contractorId: string
  phone: string
  whatsappEnabled: boolean
}

/**
 * Send payment failure alert to contractor.
 *
 * D-11: Sends alert BEFORE deactivation with "PAYMENT FAILED" prefix.
 * - SMS: "VOICEDESK ALERT: Payment failed. Your agent will be deactivated within 72 hours..."
 * - WhatsApp: Uses emergency template with "PAYMENT FAILED" callerPhone.
 *
 * @param contractorId - The contractor ID to alert
 * @param phone - Contractor's phone number (E.164 format)
 * @param whatsappEnabled - Whether WhatsApp notifications are enabled
 */
export async function sendPaymentFailureAlert({
  contractorId,
  phone,
  whatsappEnabled,
}: SendPaymentFailureAlertParams): Promise<void> {
  if (!phone) {
    console.warn(
      `[payment-alert] No phone number for contractor ${contractorId}, skipping alert`
    )
    return
  }

  // Load contractor's callId (for logging) - use a generated ID since this isn't call-related
  const alertCallId = `payment-failure-${contractorId}-${Date.now()}`

  // Send SMS alert (always)
  const smsBody = `VOICEDESK ALERT: Payment failed. Your agent will be deactivated within 72 hours. Update payment method at your account settings to keep service active.`
  const smsParams: SendSmsParams = {
    to: phone,
    body: smsBody,
    contractorId,
    callId: alertCallId,
  }

  console.log(
    `[payment-alert] Sending SMS payment failure alert to ${phone}`
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

  // Send WhatsApp alert (if enabled)
  if (whatsappEnabled) {
    const whatsappParams: SendWhatsAppParams = {
      to: phone,
      templateType: 'emergency', // Reuse emergency template for payment failure
      callerPhone: 'PAYMENT FAILED', // D-11: Use "PAYMENT FAILED" per CONTEXT
      serviceRequested: 'Update payment method to keep service active',
      contractorId,
      callId: alertCallId,
    }

    console.log(
      `[payment-alert] Sending WhatsApp payment failure alert to ${phone}`
    )

    try {
      await sendWhatsApp(whatsappParams)
    } catch (err) {
      console.error(
        `[payment-alert] WhatsApp send failed for contractor ${contractorId}:`,
        err instanceof Error ? err.message : err
      )
      // Don't throw - SMS was already sent
    }
  }

  // Log to notification_log for audit (T-07-05-01)
  await logPaymentAlertToDb({
    contractorId,
    phone,
    whatsappSent: whatsappEnabled,
    smsBody,
  })

  console.log(
    `[payment-alert] Payment failure alert complete for contractor ${contractorId}`
  )
}

async function logPaymentAlertToDb({
  contractorId,
  phone,
  whatsappSent,
  smsBody,
}: {
  contractorId: string
  phone: string
  whatsappSent: boolean
  smsBody: string
}): Promise<void> {
  const db = createServiceRoleClient()

  // Log to DB for audit (T-07-05-01) - ignore errors, main notification was sent
  try {
    await db.from('notification_log').insert({
      contractor_id: contractorId,
      call_id: null,
      channel: 'sms',
      recipient: phone,
      message: smsBody,
      status: 'sent',
    })
  } catch (err) {
    // Ignore duplicate errors
    console.warn(
      `[payment-alert] SMS notification log insert failed for contractor ${contractorId}`
    )
  }

  // Log WhatsApp if sent
  if (whatsappSent) {
    try {
      await db.from('notification_log').insert({
        contractor_id: contractorId,
        call_id: null,
        channel: 'whatsapp',
        recipient: phone,
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