// src/lib/stripe/checkout.ts
// Stripe Checkout session creation — server-only.
// D-02: 14-day trial (no card required) per CONTEXT.md decisions.
import 'server-only'

import { createServiceRoleClient } from '@/lib/supabase/service'
import { getStripeClient } from './client'

interface CreateCheckoutSessionParams {
  contractorId: string
  priceId: string
}

/**
 * Create a Stripe Checkout session for subscription with 14-day trial.
 *
 * - payment_method_collection: 'if_required' (D-02: no card required for trial)
 * - trial_period_days: 14 per D-02
 * - Metadata includes contractor_id for webhook linking
 *
 * @param contractorId - The contractor's UUID
 * @param priceId - Stripe price ID for the selected tier
 * @returns The checkout session URL to redirect the client to
 */
export async function createCheckoutSession({
  contractorId,
  priceId,
}: CreateCheckoutSessionParams): Promise<string> {
  const stripe = getStripeClient()
  const db = createServiceRoleClient()

  // Get contractor info including email
  const { data: contractor, error: contractorError } = await db
    .from('contractors')
    .select('user_id, business_name, email')
    .eq('id', contractorId)
    .single()

  if (contractorError || !contractor) {
    console.error('[stripe/checkout] contractor not found:', contractorId, contractorError)
    throw new Error('Contractor not found')
  }

  if (!contractor.email) {
    console.error('[stripe/checkout] contractor email not found:', contractorId)
    throw new Error('Contractor email not found')
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? process.env.APP_URL
  if (!appUrl) {
    throw new Error('APP_URL or NEXT_PUBLIC_APP_URL is not set')
  }

  // Ensure base URL doesn't include paths
  const baseUrl = appUrl.replace(/\/api\/auth\/google\/callback$/, '')

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    payment_method_collection: 'if_required', // D-02: No card required for trial
    subscription_data: {
      trial_period_days: 14, // D-02: 14-day no-card trial
      metadata: {
        contractor_id: contractorId,
      },
    },
    customer_email: contractor.email,
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    success_url: `${baseUrl}/dashboard?checkout=success`,
    cancel_url: `${baseUrl}/dashboard?checkout=cancelled`,
    metadata: {
      contractor_id: contractorId,
    },
  })

  if (!session.url) {
    throw new Error('Failed to create checkout session')
  }

  return session.url
}