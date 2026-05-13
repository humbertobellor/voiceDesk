// src/types/stripe.ts
// TypeScript types for Stripe integration.

/**
 * Price ID mapping for subscription tiers.
 * Env vars: STRIPE_BASIC_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_ENTERPRISE_PRICE_ID
 */
export type StripePriceId = {
  basic: string
  pro: string
  enterprise: string
}

/**
 * Tier names for subscription pricing.
 */
export type SubscriptionTier = 'basic' | 'pro' | 'enterprise'

/**
 * Parameters for creating a checkout session.
 */
export interface CreateCheckoutSessionParams {
  contractorId: string
  priceId: string
}

/**
 * Parameters for creating a customer portal session.
 */
export interface CreatePortalSessionParams {
  customerId: string
  returnUrl: string
}

/**
 * Mapping from tier name to environment variable key.
 */
export const STRIPE_TIER_PRICE_ID_MAP: Record<SubscriptionTier, keyof typeof import('process').env> = {
  basic: 'STRIPE_BASIC_PRICE_ID',
  pro: 'STRIPE_PRO_PRICE_ID',
  enterprise: 'STRIPE_ENTERPRISE_PRICE_ID',
} as const