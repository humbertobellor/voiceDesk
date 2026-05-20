// src/lib/stripe/client.ts
// Stripe SDK singleton — server-only.
// CRITICAL: STRIPE_SECRET_KEY must NEVER have NEXT_PUBLIC_ prefix (would expose to browser).
import 'server-only'
import Stripe from 'stripe'

// NOTE: This singleton persists across warm Lambda invocations on Vercel.
// If STRIPE_SECRET_KEY is rotated, a forced redeployment (triggering cold starts)
// is required for all Lambda instances to pick up the new key.
let _client: Stripe | null = null

/**
 * Get the Stripe client singleton.
 * Throws if STRIPE_SECRET_KEY is not set in environment.
 */
export function getStripeClient(): Stripe {
  if (!_client) {
    const apiKey = process.env.STRIPE_SECRET_KEY
    if (!apiKey) {
      throw new Error('STRIPE_SECRET_KEY is not set')
    }
    _client = new Stripe(apiKey, {
      apiVersion: '2026-04-22.dahlia',
    })
  }
  return _client
}