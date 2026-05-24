// src/app/api/webhooks/stripe/handlers.ts
// Stripe webhook event handlers with idempotency protection.
// Uses webhook_events table with unique constraint on source+event_type+external_id.
import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { inngest } from '@/inngest/client'
import { getRetellClient } from '@/lib/retell/client'
import type Stripe from 'stripe'

type CheckoutSession = Stripe.Checkout.Session
type Invoice = Stripe.Invoice
type Subscription = Stripe.Subscription

/**
 * UPSERT into webhook_events table for idempotency.
 * Returns true if event is new (not duplicate), false if duplicate.
 */
async function checkAndInsertIdempotency(
  source: string,
  eventType: string,
  externalId: string,
  payload: object
): Promise<boolean> {
  const db = createServiceRoleClient()

  // Try to insert — unique constraint will reject duplicates
  const { error } = await db.from('webhook_events').insert({
    source,
    event_type: eventType,
    external_id: externalId,
    payload,
    processed: true,
    processed_at: new Date().toISOString(),
  })

  if (error) {
    if (error.code === '23505') {
      // Unique constraint violation — duplicate event
      console.log(
        `[webhook/stripe] duplicate event: ${source}/${eventType}/${externalId}, skipping`
      )
      return false
    }
    // Other error — rethrow
    throw error
  }

  return true
}

/**
 * Handle checkout.session.completed — activates trial subscription.
 * D-02: Sets subscription_status = 'trialing' with 14-day no-card trial.
 * T-07-02-02: Idempotency via webhook_events table.
 */
export async function handleCheckoutCompleted(session: CheckoutSession) {
  const db = createServiceRoleClient()
  const contractorId = session.metadata?.contractor_id

  // T-07-02-02: Check for duplicate before processing
  const isNew = await checkAndInsertIdempotency(
    'stripe',
    'checkout.session.completed',
    session.id,
    session
  )
  if (!isNew) return

  if (!contractorId) {
    console.error('[webhook/stripe] checkout completed missing contractor_id in metadata')
    return
  }

  // Determine tier from metadata.price_id (set at checkout creation time).
  // line_items are not included in webhook payloads unless explicitly expanded.
  const priceId = session.metadata?.price_id ?? ''
  const tierMap: Record<string, string> = {
    [process.env.STRIPE_BASIC_PLAN_ID ?? '']: 'basic',
    [process.env.STRIPE_PROFESSIONAL_PLAN_ID ?? '']: 'professional',
    [process.env.STRIPE_ENTERPRISE_PLAN_ID ?? '']: 'enterprise',
  }
  const subscriptionTier = priceId ? tierMap[priceId] : undefined
  if (!subscriptionTier) {
    console.error(
      `[webhook/stripe] handleCheckoutCompleted: unknown price ID "${priceId}" — cannot map to subscription tier. ` +
      'Check STRIPE_BASIC_PLAN_ID / STRIPE_PROFESSIONAL_PLAN_ID / STRIPE_ENTERPRISE_PLAN_ID env vars.'
    )
    return
  }

  // D-04: Best-effort trial_ends_at from checkout session.
  // Primary write path is handleSubscriptionUpdated (Subscription.trial_end is always reliable).
  // This secondary path covers the case where subscription.updated fires before or is missed.
  type CheckoutSessionWithTrialData = Stripe.Checkout.Session & {
    subscription_data?: { trial_end?: number | null }
  }
  const rawTrialEnd = (session as CheckoutSessionWithTrialData).subscription_data?.trial_end
  const trialEndsAt = rawTrialEnd ? new Date(rawTrialEnd * 1000).toISOString() : null

  // Update contractor with Stripe customer and subscription
  await db
    .from('contractors')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      subscription_status: 'trialing', // D-02: starts in trialing
      subscription_tier: subscriptionTier,
      trial_ends_at: trialEndsAt,
    })
    .eq('id', contractorId)

  console.log(
    `[webhook/stripe] contractor ${contractorId} subscribed via checkout ${session.id}, ` +
    `status: trialing, trial_ends_at: ${trialEndsAt ?? 'will be set by subscription.updated'}`
  )
}

/**
 * Handle invoice.payment_failed — triggers Inngest event for deactivation + notification.
 * D-10: Immediate deactivation via Inngest function (Plan 5).
 * D-11: Alert before deactivation via Twilio.
 * T-07-02-02: Idempotency via webhook_events table.
 */
export async function handlePaymentFailed(invoice: Invoice) {
  const db = createServiceRoleClient()

  // T-07-02-02: Check for duplicate before processing
  const isNew = await checkAndInsertIdempotency(
    'stripe',
    'invoice.payment_failed',
    invoice.id,
    invoice
  )
  if (!isNew) return

  const customerId = invoice.customer as string

  // Find contractor by stripe_customer_id
  const { data: contractor, error } = await db
    .from('contractors')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .single()

  if (error || !contractor) {
    console.error(
      `[webhook/stripe] payment failed: could not find contractor for customer ${customerId}`,
      error?.message
    )
    return
  }

  const contractorId = contractor.id
  // Type-safe extraction: invoice.subscription may be string, Stripe.Subscription object, or null
  type InvoiceWithSubscription = Stripe.Invoice & {
    subscription?: string | Stripe.Subscription | null
  }
  const typedInvoice = invoice as InvoiceWithSubscription
  const rawSub = typedInvoice.subscription
  const subscriptionId: string | null =
    typeof rawSub === 'string'
      ? rawSub
      : rawSub != null && typeof rawSub === 'object'
      ? rawSub.id
      : null

  // Trigger Inngest event for deactivation + notification
  // This triggers Plan 5's Inngest function for D-10 (immediate deactivation) + D-11 (alert)
  // FIXED: Align with stripe-payment-failure.ts expected fields
  await inngest.send({
    name: 'stripe/payment.failed',
    data: {
      contractorId,
      stripeCustomerId: customerId, // Renamed to match Inngest handler
      failureReason: invoice.hosted_invoice_url ?? undefined, // Added failure reason
      subscriptionId,
      invoiceId: invoice.id,
    },
  })

  console.log(
    `[webhook/stripe] payment failed for contractor ${contractorId}, triggered stripe/payment.failed event`
  )
}

/**
 * Handle customer.subscription.updated — syncs subscription status to contractor record.
 * Maps Stripe status to internal status: trialing→trialing, active→active, past_due→past_due, canceled→canceled.
 * T-07-02-02: Idempotency via webhook_events table.
 */
export async function handleSubscriptionUpdated(subscription: Subscription) {
  const db = createServiceRoleClient()

  // T-07-02-02: Check for duplicate before processing
  const isNew = await checkAndInsertIdempotency(
    'stripe',
    'customer.subscription.updated',
    subscription.id,
    subscription
  )
  if (!isNew) return

  const customerId = subscription.customer as string

  // Map Stripe subscription status to internal status
  let internalStatus: string
  switch (subscription.status) {
    case 'trialing':
      internalStatus = 'trialing'
      break
    case 'active':
      internalStatus = 'active'
      break
    case 'past_due':
      internalStatus = 'past_due'
      break
    case 'canceled':
    case 'unpaid':
    case 'incomplete_expired':
      internalStatus = 'canceled'
      break
    default:
      internalStatus = 'unknown'
  }

  // Find contractor by stripe_customer_id — include is_active for D-10 reactivation guard
  const { data: contractor, error } = await db
    .from('contractors')
    .select('id, is_active')
    .eq('stripe_customer_id', customerId)
    .single()

  if (error || !contractor) {
    console.error(
      `[webhook/stripe] subscription updated: could not find contractor for customer ${customerId}`,
      error?.message
    )
    return
  }

  const contractorId = contractor.id
  // D-10: Capture whether contractor was deactivated before this event
  const wasDeactivated = contractor.is_active === false

  // Update contractor subscription status
  await db
    .from('contractors')
    .update({
      subscription_status: internalStatus,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', contractorId)

  // D-04: Write trial_ends_at from Subscription object (primary reliable path).
  // subscription.trial_end is always populated when status === 'trialing'.
  if (internalStatus === 'trialing' && subscription.trial_end) {
    await db
      .from('contractors')
      .update({ trial_ends_at: new Date(subscription.trial_end * 1000).toISOString() })
      .eq('id', contractorId)
    console.log(
      `[webhook/stripe] contractor ${contractorId} trial_ends_at set to ${new Date(subscription.trial_end * 1000).toISOString()}`
    )
  }

  if (internalStatus === 'active') {
    if (wasDeactivated) {
      // D-10: Auto-reactivation path — contractor was deactivated, payment recovered.
      // Set is_active=true, then re-link Retell. Skip the outer re-link block (handled here).
      await db
        .from('contractors')
        .update({ is_active: true })
        .eq('id', contractorId)
      console.log(`[webhook/stripe] contractor ${contractorId} reactivated: is_active set to true`)

      // D-11: Re-link Retell only if both IDs are present
      const { data: contractorFull } = await db
        .from('contractors')
        .select('retell_agent_id, twilio_number')
        .eq('id', contractorId)
        .single()

      if (contractorFull?.retell_agent_id && contractorFull?.twilio_number) {
        try {
          const retell = getRetellClient()
          await retell.phoneNumber.update(contractorFull.twilio_number, {
            inbound_agents: [{ agent_id: contractorFull.retell_agent_id, weight: 1.0 }],
          })
          console.log(
            `[webhook/stripe] Retell phone ${contractorFull.twilio_number} re-linked on reactivation for contractor ${contractorId}`
          )
        } catch (err) {
          console.error(
            `[webhook/stripe] Retell re-link on reactivation failed for contractor ${contractorId}:`,
            err instanceof Error ? err.message : err
          )
        }
      } else {
        console.log(
          `[webhook/stripe] skipping Retell re-link on reactivation for ${contractorId}: missing retell_agent_id or twilio_number`
        )
      }
    } else {
      // Existing behavior: contractor was already active — just re-link Retell as before.
      // (This path fires for routine subscription renewals or plan changes.)
      const { data: contractorFull } = await db
        .from('contractors')
        .select('retell_agent_id, twilio_number')
        .eq('id', contractorId)
        .single()

      if (contractorFull?.retell_agent_id && contractorFull?.twilio_number) {
        try {
          const retell = getRetellClient()
          await retell.phoneNumber.update(contractorFull.twilio_number, {
            inbound_agents: [{ agent_id: contractorFull.retell_agent_id, weight: 1.0 }],
          })
          console.log(
            `[webhook/stripe] Retell phone ${contractorFull.twilio_number} re-linked to agent for contractor ${contractorId}`
          )
        } catch (err) {
          // Log but don't throw — subscription status already updated; agent re-link can be retried manually
          console.error(
            `[webhook/stripe] Retell re-link failed for contractor ${contractorId}:`,
            err instanceof Error ? err.message : err
          )
        }
      }
    }
  }

  console.log(
    `[webhook/stripe] contractor ${contractorId} subscription updated to ${internalStatus}`
  )
}