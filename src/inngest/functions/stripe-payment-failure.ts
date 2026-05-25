// src/inngest/functions/stripe-payment-failure.ts
// Inngest function triggered by stripe/payment.failed event.
// D-05: Channel-flag gating — passes notify_sms_enabled / notify_whatsapp_enabled to alert helper.
// D-06: load-contractor fetches all four notification_settings channel fields.
// D-08: mark-agent-inactive writes is_active=false + subscription_status='past_due' atomically.
// D-10: Deactivate Retell agent immediately after payment failure.
// D-11: Send WhatsApp/SMS alert before deactivation (within 72 hours of final failed retry).
// BILL-03: Payment failure handling per CONTEXT.md decisions.
// retries: 3 — fewer than call classification since this is a one-time failure event.
import 'server-only'
import { NonRetriableError } from 'inngest'
import { inngest } from '@/inngest/client'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { getRetellClient } from '@/lib/retell/client'
import { sendPaymentFailureAlert } from '@/lib/notifications/payment-alert'
import { sendEmail } from '@/lib/notifications/email'
import { writeNotificationLog, updateNotificationLog } from '@/lib/notifications/log'
import { render } from '@react-email/render'
import { PaymentFailureEmail } from '@/lib/notifications/templates/PaymentFailureEmail'

// BILL-03: Inngest function handles payment failure + alert + deactivation.
export const stripePaymentFailureHandler = inngest.createFunction(
  {
    id: 'stripe-payment-failure-handler',
    retries: 3, // D-10: fewer retries than call classification (payment failure is final)
    triggers: [{ event: 'stripe/payment.failed' }],
    onFailure: async ({ event }) => {
      // All retries exhausted — log for audit (T-07-05-01).
      // No automatic status update — manual intervention may be required.
      const contractorId = (event.data.event.data as { contractorId?: string }).contractorId
      console.error('[voicedesk]', JSON.stringify({
        event: 'stripe-payment-failure.failed',
        contractor_id: contractorId ?? 'unknown',
        error: 'all retries exhausted',
      }))
    },
  },
  async ({ event, step }) => {
    const { contractorId, stripeCustomerId, failureReason } = event.data as {
      contractorId: string
      stripeCustomerId: string
      failureReason?: string
    }

    // Validate required fields — NonRetriableError if event data is corrupt
    if (!contractorId) {
      throw new NonRetriableError(
        `[stripe-payment-failure] invalid event data: missing contractorId`
      )
    }

    // T-07-05-01: Audit logging for repudiation protection
    console.log(
      `[stripe-payment-failure] Processing payment failure for contractor ${contractorId} (customer: ${stripeCustomerId}). Reason: ${failureReason ?? 'unknown'}`
    )

    // Step 1: Load contractor data needed for alert and deactivation
    const contractor = await step.run('load-contractor', async () => {
      const db = createServiceRoleClient()
      const { data, error } = await db
        .from('contractors')
        .select('id, retell_agent_id, twilio_number, phone_number, notification_settings(sms_number, whatsapp_number, email_address, notify_sms_enabled, notify_whatsapp_enabled, notify_email_enabled, notify_on_payment_failure)')
        .eq('id', contractorId)
        .maybeSingle()
      if (error || !data) {
        throw new NonRetriableError(
          `[stripe-payment-failure] contractor ${contractorId} not found`
        )
      }
      return data
    })

    // Step 2: Send payment failure alert (D-11: alert before deactivation)
    await step.run('send-payment-alert', async () => {
      // D-06: Resolve channel flags from notification_settings join (take [0] — array join).
      const ns = (contractor.notification_settings as Array<{
        sms_number: string | null
        whatsapp_number: string | null
        notify_sms_enabled: boolean
        notify_whatsapp_enabled: boolean
      }> | null)?.[0]

      // Resolve SMS number: notification_settings.sms_number ?? contractor.phone_number
      const smsNumber = ns?.sms_number ?? contractor.phone_number ?? null

      // T-07-05-01: Log alert sending attempt
      console.log(
        `[stripe-payment-failure] Sending payment failure alert to contractor ${contractorId}`
      )
      await sendPaymentFailureAlert({
        contractorId,
        smsNumber,
        smsEnabled: ns?.notify_sms_enabled ?? true,          // DEFAULT TRUE — existing contractors unaffected
        whatsappNumber: ns?.whatsapp_number ?? null,
        whatsappEnabled: ns?.notify_whatsapp_enabled ?? false, // DEFAULT FALSE — opt-in channel
      })
    })

    // Step 2.5a: Send payment failure email (EMAIL-04 / D-07 triple-gate / D-18: callId=null)
    // Triple gate: email_address != null AND notify_email_enabled=true AND notify_on_payment_failure=true
    // D-06: Static imports at file top — not dynamic imports inside step.run.
    await step.run('send-email-alert', async () => {
      const ns = (contractor.notification_settings as Array<{
        email_address: string | null
        notify_email_enabled: boolean
        notify_on_payment_failure: boolean
      }> | null)?.[0]

      // D-08: All three conditions must be true; silently skip if any is false (no log entry)
      if (!ns?.email_address || !ns?.notify_email_enabled || !ns?.notify_on_payment_failure) {
        return
      }

      const billingUrl = `${process.env.NEXT_PUBLIC_APP_URL}/settings/account`

      // render() from @react-email/render v2.x is async (returns Promise<string>)
      const emailHtml = await render(PaymentFailureEmail({ billingUrl }))

      let logId: string | null = null
      try {
        // D-18: Payment failure emails are not call-related — callId is null
        logId = await writeNotificationLog({
          contractorId,
          callId: null,
          channel: 'email',
          recipient: ns.email_address,
          message: 'Payment failure alert',
        })

        const result = await sendEmail({
          to: ns.email_address,
          subject: 'Action required: VoiceDesk payment failed',
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

    // Step 2.5b: Unlink Retell agent from phone number (BILL-03: true deactivation)
    await step.run('deactivate-retell-agent', async () => {
      if (!contractor.retell_agent_id || !contractor.twilio_number) {
        console.log(
          `[stripe-payment-failure] no retell_agent_id or twilio_number for ${contractorId}, skipping Retell deactivation`
        )
        return
      }
      try {
        const retell = getRetellClient()
        await retell.phoneNumber.update(contractor.twilio_number, { inbound_agents: [] })
        console.log(
          `[stripe-payment-failure] Retell phone ${contractor.twilio_number} unlinked from agent for contractor ${contractorId}`
        )
      } catch (err) {
        // Log but do not rethrow — DB deactivation must still proceed even if Retell API is down
        console.error('[voicedesk]', JSON.stringify({
          event: 'retell-deactivation.failed',
          contractor_id: contractorId,
          error: err instanceof Error ? err.message : String(err),
        }))
      }
    })

    // Step 3: Set agent to inactive (D-08: write is_active=false + subscription_status='past_due' atomically).
    // D-08: Replaces the old agent_sync_status='failed' hack with the proper boolean column.
    // Both fields are written in a single update — simpler audit trail (T-11-02-03).
    await step.run('mark-agent-inactive', async () => {
      const db = createServiceRoleClient()
      const { error } = await db
        .from('contractors')
        .update({ is_active: false, subscription_status: 'past_due' })
        .eq('id', contractorId)
      if (error) {
        console.error(
          `[stripe-payment-failure] mark-agent-inactive failed:`,
          error.message
        )
        throw new Error(error.message)
      }
      console.log(
        `[stripe-payment-failure] Marked contractor ${contractorId} inactive (is_active=false, subscription_status=past_due)`
      )
    })

    // T-07-05-01: Final audit log
    console.log(
      `[stripe-payment-failure] COMPLETE: Payment failure handled for contractor ${contractorId}. Agent deactivated (is_active=false), subscription_status=past_due.`
    )
  }
)