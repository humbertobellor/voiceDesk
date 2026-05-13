// src/lib/stripe/portal.ts
// Stripe Customer Portal session creation — server-only.
// D-04: Customer portal for plan management per CONTEXT.md decisions.
import 'server-only'

import { getStripeClient } from './client'

interface CreatePortalSessionParams {
  customerId: string
  returnUrl: string
}

/**
 * Create a Stripe Customer Portal session for self-serve subscription management.
 *
 * - Uses default portal configuration
 * - Allows plan changes, payment method updates, cancellation
 *
 * @param customerId - The Stripe customer ID
 * @param returnUrl - URL to return to after portal session ends
 * @returns The portal session URL to redirect the client to
 */
export async function createPortalSession({
  customerId,
  returnUrl,
}: CreatePortalSessionParams): Promise<string> {
  const stripe = getStripeClient()

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
    configuration: undefined, // Use default portal configuration
  })

  return session.url
}