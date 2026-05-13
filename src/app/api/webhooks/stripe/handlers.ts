// src/app/api/webhooks/stripe/handlers.ts
// Stripe webhook event handlers with idempotency protection.
// Uses webhook_events table with unique constraint on source+event_type+external_id.
import 'server-only'
import { createServiceRoleClient } from '@/lib/supabase/service'
import { inngest } from '@/inngest/client'
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
  externalId: string
): Promise<boolean> {
  const db = createServiceRoleClient()

  // Try to insert — unique constraint will reject duplicates
  const { error } = await db.from('webhook_events').insert({
    source,
    event_type: eventType,
    external_id: externalId,
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
    session.id
  )
  if (!isNew) return

  if (!contractorId) {
    console.error('[webhook/stripe] checkout completed missing contractor_id in metadata')
    return
  }

  // Determine tier from price (simplified — in production, lookup price_id mapping)
  const subscriptionTier = 'basic' // Default tier, would derive from session.price

  // Update contractor with Stripe customer and subscription
  await db
    .from('contractors')
    .update({
      stripe_customer_id: session.customer as string,
      stripe_subscription_id: session.subscription as string,
      subscription_status: 'trialing', // D-02: starts in trialing
      subscription_tier: subscriptionTier,
    })
    .eq('id', contractorId)

  console.log(
    `[webhook/stripe] contractor ${contractorId} subscribed via checkout ${session.id}, status: trialing`
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
    invoice.id
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
  // invoice.subscription is the subscription ID string (not a nested object in recent Stripe API)
  const subscriptionId = (invoice as any).subscription ?? invoice.id

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
    subscription.id
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

  // Find contractor by stripe_customer_id
  const { data: contractor, error } = await db
    .from('contractors')
    .select('id')
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

  // Update contractor subscription status
  await db
    .from('contractors')
    .update({
      subscription_status: internalStatus,
      stripe_subscription_id: subscription.id,
    })
    .eq('id', contractorId)

  console.log(
    `[webhook/stripe] contractor ${contractorId} subscription updated to ${internalStatus}`
  )
}