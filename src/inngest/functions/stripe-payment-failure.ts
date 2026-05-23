// src/inngest/functions/stripe-payment-failure.ts
// Inngest function triggered by stripe/payment.failed event.
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
        .select('id, retell_agent_id, twilio_number, phone_number, notification_settings(whatsapp_number)')
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
      // T-07-05-01: Log alert sending attempt
      console.log(
        `[stripe-payment-failure] Sending payment failure alert to contractor ${contractorId}`
      )
      await sendPaymentFailureAlert({
        contractorId,
        phone: contractor.phone_number,
        whatsappEnabled: !!(contractor.notification_settings as Array<{ whatsapp_number: string | null }> | null)?.[0]?.whatsapp_number,
      })
    })

    // Step 2.5: Unlink Retell agent from phone number (BILL-03: true deactivation)
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

    // Step 3: Set agent to inactive (D-10: immediate deactivation)
    // Note: Retell SDK doesn't expose direct agent status via API - setting subscription_status='past_due'
    // triggers the portal flow. For true agent deactivation, use Retell Dashboard or manage via retell_agent_id.
    await step.run('mark-agent-inactive', async () => {
      // Mark as inactive in our DB - this will prevent new calls from using this agent
      const db = createServiceRoleClient()
      const { error } = await db
        .from('contractors')
        .update({ agent_sync_status: 'failed' }) // Use 'failed' to indicate inactive
        .eq('id', contractorId)
      if (error) {
        console.error(
          `[stripe-payment-failure] mark-agent-inactive failed:`,
          error.message
        )
        throw new Error(error.message)
      }
      console.log(
        `[stripe-payment-failure] Marked agent as inactive in DB for contractor ${contractorId}`
      )
    })

    // Step 4: Update contractor subscription_status to 'past_due'
    await step.run('update-subscription-status', async () => {
      const db = createServiceRoleClient()
      const { error } = await db
        .from('contractors')
        .update({ subscription_status: 'past_due' })
        .eq('id', contractorId)
      if (error) {
        console.error(
          `[stripe-payment-failure] update-subscription-status failed:`,
          error.message
        )
        throw new Error(error.message)
      }
      console.log(
        `[stripe-payment-failure] Updated subscription_status to 'past_due' for contractor ${contractorId}`
      )
    })

    // T-07-05-01: Final audit log
    console.log(
      `[stripe-payment-failure] COMPLETE: Payment failure handled for contractor ${contractorId}. Agent deactivated, status set to past_due.`
    )
  }
)